import {
    createAppError,
    createCommandId,
    createRequestId,
    isAppError,
    nowTimestampMs,
    type AppError,
    type CommandId,
    type NodeId,
    type RuntimeInstanceId,
} from '@impos2/kernel-base-contracts'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import {moduleName} from '../moduleName'
import type {
    ActorExecutionContext,
    ActorExecutionResult,
    CommandAggregateResult,
    CommandAggregateStatus,
    CommandIntent,
    DispatchOptions,
    DispatchedCommand,
    PeerDispatchGateway,
    RegisteredActorHandler,
    RequestQueryResult,
    RuntimeModuleContextV2,
} from '../types'
import type {createRequestLedger} from './requestLedger'

const normalizeError = (error: unknown, command: DispatchedCommand): AppError => {
    if (isAppError(error)) {
        return error
    }
    return createAppError({
        key: `${moduleName}.command_execution_failed`,
        code: 'ERR_RUNTIME_SHELL_V2_COMMAND_EXECUTION_FAILED',
        name: 'Runtime Shell V2 Command Execution Failed',
        defaultTemplate: 'Command ${commandName} execution failed',
        category: 'SYSTEM',
        severity: 'MEDIUM',
        moduleName,
    }, {
        args: {commandName: command.commandName},
        context: {
            commandName: command.commandName,
            commandId: command.commandId,
            requestId: command.requestId,
        },
        cause: error,
    })
}

const aggregateStatus = (
    actorResults: readonly ActorExecutionResult[],
    allowNoActor: boolean,
): CommandAggregateStatus => {
    if (actorResults.length === 0) {
        return allowNoActor ? 'COMPLETED' : 'FAILED'
    }
    if (actorResults.some(result => result.status === 'TIMEOUT')) {
        return 'TIMEOUT'
    }
    const failedCount = actorResults.filter(result => result.status === 'FAILED').length
    if (failedCount === 0) {
        return 'COMPLETED'
    }
    if (failedCount === actorResults.length) {
        return 'FAILED'
    }
    return 'PARTIAL_FAILED'
}

interface CreateRuntimeCommandDispatcherInput {
    runtimeId: RuntimeInstanceId
    localNodeId: NodeId
    store: EnhancedStore
    dispatchAction: (action: UnknownAction) => UnknownAction
    subscribeState: (listener: () => void) => () => void
    ledger: ReturnType<typeof createRequestLedger>
    handlersByCommand: Map<string, RegisteredActorHandler[]>
    resolveParameter: RuntimeModuleContextV2['resolveParameter']
    queryRequest: (requestId: string) => RequestQueryResult | undefined
    getPeerDispatchGateway: () => PeerDispatchGateway | undefined
    displayContext: RuntimeModuleContextV2['displayContext']
    resetApplicationState?: (input?: {reason?: string}) => Promise<void>
}

export const createRuntimeCommandDispatcher = (
    input: CreateRuntimeCommandDispatcherInput,
) => {
    /**
     * 设计意图：
     * v2 的 Command 天然是广播语义，同一个 commandName 可以被多个 Actor 处理并聚合结果。
     * executionStack 只防同 request 内“同 Command + 同 Actor”的递归重入，允许不同 request 并发，也允许 Actor 再发子 Command。
     */
    const executionStack: Array<{
        requestId: import('@impos2/kernel-base-contracts').RequestId
        commandName: string
        actorKey: string
        commandId: CommandId
    }> = []
    const pendingResetByRequestId = new Map<import('@impos2/kernel-base-contracts').RequestId, {reason?: string}>()

    const dispatchLocal = async <TPayload>(
        commandIntent: CommandIntent<TPayload>,
        options: DispatchOptions = {},
    ): Promise<CommandAggregateResult> => {
        const requestId = options.requestId ?? createRequestId()
        const commandId = options.commandId ?? createCommandId()
        const dispatched: DispatchedCommand<TPayload> = {
            runtimeId: input.runtimeId,
            requestId,
            commandId,
            parentCommandId: options.parentCommandId,
            commandName: commandIntent.definition.commandName,
            payload: commandIntent.payload,
            target: options.target ?? commandIntent.definition.defaultTarget,
            routeContext: options.routeContext,
            dispatchedAt: nowTimestampMs(),
        }

        if (dispatched.target === 'peer') {
            // peer 执行仍然先登记本地 request，这样前端 selector 能同步看到“已开始”，再等待拓扑网关回填远端结果。
            input.ledger.registerCommand(dispatched)
            const peerDispatchGateway = input.getPeerDispatchGateway()
            if (!peerDispatchGateway) {
                const error = normalizeError(new Error('Peer dispatch gateway is not installed'), dispatched)
                return input.ledger.completeCommand(requestId, commandId, 'FAILED', [
                    {
                        actorKey: 'runtime-shell-v2.peer-dispatch',
                        status: 'FAILED',
                        startedAt: dispatched.dispatchedAt,
                        completedAt: nowTimestampMs(),
                        error,
                    },
                ])
            }
            try {
                const peerResult = await peerDispatchGateway.dispatchCommand(commandIntent, {...options, requestId})
                const actorStatus: ActorExecutionResult['status'] =
                    peerResult.status === 'TIMEOUT'
                        ? 'TIMEOUT'
                        : peerResult.status === 'FAILED'
                            ? 'FAILED'
                            : 'COMPLETED'
                return input.ledger.completeCommand(requestId, commandId, peerResult.status, [
                    {
                        actorKey: 'runtime-shell-v2.peer-dispatch',
                        status: actorStatus,
                        startedAt: dispatched.dispatchedAt,
                        completedAt: nowTimestampMs(),
                        result: {
                            remoteRequestId: peerResult.requestId,
                            remoteCommandId: peerResult.commandId,
                            remoteStatus: peerResult.status,
                            remoteActorResults: peerResult.actorResults,
                        },
                    },
                ])
            } catch (error) {
                return input.ledger.completeCommand(requestId, commandId, 'FAILED', [
                    {
                        actorKey: 'runtime-shell-v2.peer-dispatch',
                        status: 'FAILED',
                        startedAt: dispatched.dispatchedAt,
                        completedAt: nowTimestampMs(),
                        error: normalizeError(error, dispatched),
                    },
                ])
            }
        }

        input.ledger.registerCommand(dispatched)
        const handlers = [...(input.handlersByCommand.get(dispatched.commandName) ?? [])]
            .sort((left, right) => left.order - right.order)

        if (handlers.length === 0) {
            return input.ledger.completeCommand(
                requestId,
                commandId,
                aggregateStatus([], commandIntent.definition.allowNoActor),
                [],
            )
        }

        const actorResults = await Promise.all(handlers.map(async handler => {
            const reentryKey = `${dispatched.requestId}:${dispatched.commandName}:${handler.actor.actorKey}`
            const inStack = executionStack.some(entry =>
                entry.requestId === dispatched.requestId
                && entry.commandName === dispatched.commandName
                && entry.actorKey === handler.actor.actorKey,
            )
            if (inStack && !commandIntent.definition.allowReentry) {
                const failedResult: ActorExecutionResult = {
                    actorKey: handler.actor.actorKey,
                    status: 'FAILED',
                    startedAt: nowTimestampMs(),
                    completedAt: nowTimestampMs(),
                    error: normalizeError(new Error(`Command actor re-entry is not allowed: ${reentryKey}`), dispatched),
                }
                input.ledger.markActorCompleted(requestId, commandId, failedResult)
                return failedResult
            }

            input.ledger.markActorStarted(requestId, commandId, handler.actor.actorKey)
            const startedAt = nowTimestampMs()
            executionStack.push({
                requestId: dispatched.requestId,
                commandName: dispatched.commandName,
                actorKey: handler.actor.actorKey,
                commandId: dispatched.commandId,
            })

            try {
                const context: ActorExecutionContext<TPayload> = {
                    runtimeId: input.runtimeId,
                    localNodeId: input.localNodeId,
                    displayContext: input.displayContext,
                    command: dispatched,
                    actor: handler.actor,
                    getState: () => input.store.getState() as any,
                    dispatchAction: input.dispatchAction,
                    subscribeState: input.subscribeState,
                    dispatchCommand: childCommand => dispatchLocal(childCommand, {
                        requestId,
                        parentCommandId: dispatched.commandId,
                    }),
                    requestApplicationReset(resetInput) {
                        pendingResetByRequestId.set(requestId, resetInput ?? {})
                    },
                    queryRequest: input.queryRequest,
                    resolveParameter: input.resolveParameter,
                }
                let timeoutId: ReturnType<typeof setTimeout> | undefined
                const timeout = new Promise<ActorExecutionResult>(resolve => {
                    timeoutId = setTimeout(() => {
                        resolve({
                            actorKey: handler.actor.actorKey,
                            status: 'TIMEOUT',
                            startedAt,
                            completedAt: nowTimestampMs(),
                        })
                    }, commandIntent.definition.timeoutMs)
                })
                let execution: Promise<ActorExecutionResult>
                try {
                    execution = Promise.resolve(handler.handle(context))
                        .then((result): ActorExecutionResult => ({
                            actorKey: handler.actor.actorKey,
                            status: 'COMPLETED',
                            startedAt,
                            completedAt: nowTimestampMs(),
                            result: result ?? undefined,
                        }))
                        .catch((error): ActorExecutionResult => ({
                            actorKey: handler.actor.actorKey,
                            status: 'FAILED',
                            startedAt,
                            completedAt: nowTimestampMs(),
                            error: normalizeError(error, dispatched),
                        }))
                } catch (error) {
                    execution = Promise.resolve({
                        actorKey: handler.actor.actorKey,
                        status: 'FAILED' as const,
                        startedAt,
                        completedAt: nowTimestampMs(),
                        error: normalizeError(error, dispatched),
                    })
                }

                const actorResult = await Promise.race([execution, timeout])
                if (timeoutId) {
                    clearTimeout(timeoutId)
                }
                input.ledger.markActorCompleted(requestId, commandId, actorResult)
                return actorResult
            } finally {
                const index = executionStack.findIndex(entry =>
                    entry.commandId === dispatched.commandId && entry.actorKey === handler.actor.actorKey,
                )
                if (index >= 0) {
                    executionStack.splice(index, 1)
                }
            }
        }))

        const aggregateResult = input.ledger.completeCommand(
            requestId,
            commandId,
            aggregateStatus(actorResults, commandIntent.definition.allowNoActor),
            actorResults,
        )

        if (options.parentCommandId == null) {
            const pendingReset = pendingResetByRequestId.get(requestId)
            if (pendingReset) {
                pendingResetByRequestId.delete(requestId)
                await input.resetApplicationState?.(pendingReset)
            }
        }

        return aggregateResult
    }

    return {
        dispatchCommand: dispatchLocal,
    }
}
