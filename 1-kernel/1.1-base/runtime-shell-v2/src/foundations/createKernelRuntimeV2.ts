import {
    createAppError,
    createCommandId,
    createNodeId,
    createRequestId,
    createRuntimeInstanceId,
    nowTimestampMs,
    type AppError,
    type CommandId,
    type ParameterDefinition,
    type ResolvedParameter,
    type StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import {
    applySliceSyncDiff,
    createStateRuntime,
    type StateRuntimeSliceDescriptor,
} from '@impos2/kernel-base-state-runtime'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import type {LoggerPort, PlatformPorts} from '@impos2/kernel-base-platform-ports'
import {moduleName} from '../moduleName'
import type {
    ActorExecutionContext,
    ActorExecutionResult,
    CommandAggregateResult,
    CommandAggregateStatus,
    CommandQueryResult,
    CommandIntent,
    CreateKernelRuntimeV2Input,
    DispatchOptions,
    DispatchedCommand,
    KernelRuntimeV2,
    PeerDispatchGateway,
    RegisteredActorHandler,
} from '../types'
import {createCommand} from './command'
import {createRequestLedger} from './requestLedger'
import {createRuntimeShellInternalModuleV2} from './internalModule'
import {runtimeShellV2CommandDefinitions} from '../features/commands'
import {runtimeShellV2StateActions} from '../features/slices'
import {RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY} from '../features/slices/parameterCatalogState'

const noopLogger: LoggerPort = {
    emit() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    scope() {
        return this
    },
    withContext() {
        return this
    },
}

const createDefaultPorts = (ports?: Partial<PlatformPorts>): PlatformPorts => ({
    environmentMode: ports?.environmentMode ?? 'DEV',
    logger: ports?.logger ?? noopLogger,
    scriptExecutor: ports?.scriptExecutor,
    stateStorage: ports?.stateStorage,
    secureStateStorage: ports?.secureStateStorage,
    device: ports?.device,
    appControl: ports?.appControl,
    localWebServer: ports?.localWebServer,
    connector: ports?.connector,
})

const normalizeError = (error: unknown, command: DispatchedCommand): AppError => {
    if (typeof error === 'object' && error !== null && 'key' in error && 'message' in error) {
        return error as AppError
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

const isFinalCommandAggregateResult = (
    command: CommandQueryResult,
): command is CommandAggregateResult => command.status !== 'RUNNING'

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

const toCatalogErrorEntry = (definition: {
    key: string
    defaultTemplate: string
}) => ({
    key: definition.key,
    template: definition.defaultTemplate,
    updatedAt: nowTimestampMs(),
    source: 'default' as const,
})

const toCatalogParameterEntry = <TValue>(definition: ParameterDefinition<TValue>) => ({
    key: definition.key,
    rawValue: definition.defaultValue,
    updatedAt: nowTimestampMs(),
    source: 'default' as const,
})

export const createKernelRuntimeV2 = (
    input: CreateKernelRuntimeV2Input = {},
): KernelRuntimeV2 => {
    const runtimeId = input.runtimeId ?? createRuntimeInstanceId()
    const localNodeId = input.localNodeId ?? createNodeId()
    const platformPorts = createDefaultPorts(input.platformPorts)
    const modules = [
        createRuntimeShellInternalModuleV2(),
        ...(input.modules ?? []),
    ]
    const stateRuntime = createStateRuntime({
        runtimeName: moduleName,
        logger: platformPorts.logger.scope({moduleName, subsystem: 'state-runtime'}),
        slices: modules.flatMap(module => [...(module.stateSlices ?? [])]),
        stateStorage: platformPorts.stateStorage,
        secureStateStorage: platformPorts.secureStateStorage,
        persistenceKey: `kernel-runtime-v2:${localNodeId}:app-state`,
        allowPersistence: true,
    })
    const ledger = createRequestLedger()
    const handlersByCommand = new Map<string, RegisteredActorHandler[]>()
    const executionStack: Array<{
        requestId: import('@impos2/kernel-base-contracts').RequestId
        commandName: string
        actorKey: string
        commandId: CommandId
    }> = []
    let actorOrder = 0
    let startPromise: Promise<void> | null = null
    let peerDispatchGateway: PeerDispatchGateway | undefined = input.peerDispatchGateway

    const store = stateRuntime.getStore() as EnhancedStore
    const dispatchAction = (action: UnknownAction) => store.dispatch(action)
    const queryRequest = (requestId: string) => ledger.query(requestId as any)
    const subscribeState = (listener: () => void) => store.subscribe(listener)
    const getSyncSlices = () => stateRuntime.getSlices().filter(slice => Boolean(slice.sync))
    const registerMirroredCommand = (mirror: {
        requestId: import('@impos2/kernel-base-contracts').RequestId
        commandId: import('@impos2/kernel-base-contracts').CommandId
        parentCommandId?: import('@impos2/kernel-base-contracts').CommandId
        commandName: string
        target?: import('../types').CommandTarget
        routeContext?: import('@impos2/kernel-base-contracts').CommandRouteContext
    }) => {
        ledger.registerMirroredCommand(mirror)
    }
    const applyRemoteCommandEvent = (envelope: import('@impos2/kernel-base-contracts').CommandEventEnvelope) => {
        ledger.applyRemoteCommandEvent(envelope)
    }
    const applyRequestLifecycleSnapshot = (snapshot: import('@impos2/kernel-base-contracts').RequestLifecycleSnapshot) => {
        ledger.applyRequestLifecycleSnapshot(snapshot)
    }

    const resolveParameter = <TValue>(resolveInput: {
        key: string
        definition?: ParameterDefinition<TValue>
    }): ResolvedParameter<TValue> => {
        const state = store.getState() as Record<string, unknown>
        const catalog = state[RUNTIME_SHELL_V2_PARAMETER_CATALOG_STATE_KEY] as
            | Record<string, {rawValue?: unknown}>
            | undefined
        const catalogEntry = catalog?.[resolveInput.key]
        const definition = resolveInput.definition

        if (catalogEntry && definition) {
            const decoded = definition.decode
                ? definition.decode(catalogEntry.rawValue)
                : catalogEntry.rawValue as TValue
            const valid = definition.validate?.(decoded) ?? true
            return {
                key: resolveInput.key,
                value: valid ? decoded : definition.defaultValue,
                source: valid ? 'catalog' : 'catalog-fallback',
                valid,
            }
        }

        if (catalogEntry) {
            return {
                key: resolveInput.key,
                value: catalogEntry.rawValue as TValue,
                source: 'catalog',
                valid: true,
            }
        }

        if (definition) {
            return {
                key: resolveInput.key,
                value: definition.defaultValue,
                source: 'default',
                valid: true,
            }
        }

        return {
            key: resolveInput.key,
            value: undefined as TValue,
            source: 'default',
            valid: false,
        }
    }

    const applyStateSyncDiff = (envelope: StateSyncDiffEnvelope) => {
        const state = store.getState() as Record<string, unknown>
        const nextSlices: Record<string, unknown> = {}

        for (const slice of stateRuntime.getSlices() as readonly StateRuntimeSliceDescriptor<any>[]) {
            const diff = envelope.diffBySlice[slice.name]
            if (!diff || !slice.sync) {
                continue
            }

            const currentSliceState = state[slice.name]
            if (!currentSliceState || typeof currentSliceState !== 'object') {
                continue
            }

            nextSlices[slice.name] = applySliceSyncDiff(
                slice,
                currentSliceState as Record<string, unknown>,
                diff as any,
            )
        }

        if (Object.keys(nextSlices).length > 0) {
            stateRuntime.applySlicePatches(nextSlices)
        }
    }

    const dispatchLocal = async <TPayload>(
        commandIntent: CommandIntent<TPayload>,
        options: DispatchOptions = {},
    ): Promise<CommandAggregateResult> => {
        const requestId = options.requestId ?? createRequestId()
        const commandId = options.commandId ?? createCommandId()
        const dispatched: DispatchedCommand<TPayload> = {
            runtimeId,
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
            ledger.registerCommand(dispatched)
            if (!peerDispatchGateway) {
                const error = normalizeError(new Error('Peer dispatch gateway is not installed'), dispatched)
                return ledger.completeCommand(requestId, commandId, 'FAILED', [
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
                return ledger.completeCommand(requestId, commandId, peerResult.status, [
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
                return ledger.completeCommand(requestId, commandId, 'FAILED', [
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

        ledger.registerCommand(dispatched)
        const handlers = [...(handlersByCommand.get(dispatched.commandName) ?? [])]
            .sort((left, right) => left.order - right.order)

        if (handlers.length === 0) {
            return ledger.completeCommand(
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
                ledger.markActorCompleted(requestId, commandId, failedResult)
                return failedResult
            }

            ledger.markActorStarted(requestId, commandId, handler.actor.actorKey)
            const startedAt = nowTimestampMs()
            executionStack.push({
                requestId: dispatched.requestId,
                commandName: dispatched.commandName,
                actorKey: handler.actor.actorKey,
                commandId: dispatched.commandId,
            })

            try {
                const context: ActorExecutionContext<TPayload> = {
                    runtimeId,
                    localNodeId,
                    command: dispatched,
                    actor: handler.actor,
                    getState: () => store.getState() as any,
                    dispatchAction,
                    subscribeState,
                    dispatchCommand: childCommand => dispatchLocal(childCommand, {
                        requestId,
                        parentCommandId: dispatched.commandId,
                    }),
                    queryRequest,
                    resolveParameter,
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
                ledger.markActorCompleted(requestId, commandId, actorResult)
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

        return ledger.completeCommand(
            requestId,
            commandId,
            aggregateStatus(actorResults, commandIntent.definition.allowNoActor),
            actorResults,
        )
    }

    modules.forEach(module => {
        ;(module.actorDefinitions ?? []).forEach(actorDefinition => {
            const actorKey = actorDefinition.actorKey ?? `${actorDefinition.moduleName}.${actorDefinition.actorName}`
            actorDefinition.handlers.forEach(handler => {
                const next = handlersByCommand.get(handler.commandName) ?? []
                next.push({
                    actor: {
                        actorKey,
                        moduleName: actorDefinition.moduleName,
                        actorName: actorDefinition.actorName,
                    },
                    commandName: handler.commandName,
                    handle: handler.handle,
                    order: actorOrder++,
                })
                handlersByCommand.set(handler.commandName, next)
            })
        })
    })

    return {
        runtimeId,
        localNodeId,
        async start() {
            if (startPromise) {
                return await startPromise
            }
            startPromise = (async () => {
                platformPorts.logger.info({
                    category: 'runtime.load',
                    event: 'runtime-shell-v2-start',
                    message: 'start runtime-shell-v2',
                    data: {
                        runtimeId,
                        localNodeId,
                        modules: modules.map(item => item.moduleName),
                        actorCount: [...handlersByCommand.values()].reduce((count, value) => count + value.length, 0),
                    },
                })
                await stateRuntime.hydratePersistence()
                for (const module of modules) {
                    module.errorDefinitions?.forEach(definition => {
                        dispatchAction(runtimeShellV2StateActions.setErrorCatalogEntry(toCatalogErrorEntry(definition)))
                    })
                    module.parameterDefinitions?.forEach(definition => {
                        dispatchAction(runtimeShellV2StateActions.setParameterCatalogEntry(toCatalogParameterEntry(definition)))
                    })
                }
                for (const module of modules) {
                    await module.install?.({
                        moduleName: module.moduleName,
                        localNodeId,
                        platformPorts,
                        getState: () => store.getState() as any,
                        getStore: () => store,
                        dispatchAction,
                        subscribeState,
                        dispatchCommand: dispatchLocal,
                        installPeerDispatchGateway(gateway) {
                            peerDispatchGateway = gateway
                        },
                        queryRequest,
                        resolveParameter,
                        registerMirroredCommand,
                        applyRemoteCommandEvent,
                        applyRequestLifecycleSnapshot,
                        getSyncSlices,
                        applyStateSyncDiff,
                    })
                }

                const initializeResult = await dispatchLocal(
                    createCommand(runtimeShellV2CommandDefinitions.initialize, {}),
                )

                if (initializeResult.status !== 'COMPLETED') {
                    platformPorts.logger.error({
                        category: 'runtime.load',
                        event: 'runtime-shell-v2-initialize-failed',
                        message: 'runtime-shell-v2 initialize failed',
                        data: {
                            runtimeId,
                            localNodeId,
                            requestId: initializeResult.requestId,
                            commandId: initializeResult.commandId,
                            status: initializeResult.status,
                            actorResults: initializeResult.actorResults,
                        },
                    })
                    throw new Error(`runtime-shell-v2 initialize failed: ${initializeResult.status}`)
                }
            })()
            return await startPromise
        },
        dispatchCommand(command, options) {
            return dispatchLocal(command, options)
        },
        queryRequest(requestId) {
            return ledger.query(requestId)
        },
        subscribeRequest(requestId, listener) {
            return ledger.subscribeRequest(requestId, listener)
        },
        subscribeRequests(listener) {
            return ledger.subscribeRequests(listener)
        },
        subscribeState,
        getState() {
            return store.getState() as any
        },
        getStore() {
            return store
        },
        resolveParameter,
        registerMirroredCommand,
        applyRemoteCommandEvent,
        applyRequestLifecycleSnapshot,
        getSyncSlices,
        applyStateSyncDiff,
        installPeerDispatchGateway(gateway) {
            peerDispatchGateway = gateway
        },
        async flushPersistence() {
            await stateRuntime.flushPersistence()
        },
    }
}
