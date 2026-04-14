import {
    createCommandId,
    createEnvelopeId,
    nowTimestampMs,
    type AppError,
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
    type CommandId,
    type CommandRouteContext,
    type NodeId,
    type RequestId,
    type RequestLifecycleSnapshot,
    type RequestProjection,
    type SessionId,
} from '@impos2/kernel-base-contracts'
import {createPlatformPorts, createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    defineCommand,
    onCommand,
    type CommandDefinition,
    type KernelRuntimeModuleV2,
    type KernelRuntimeV2,
} from '@impos2/kernel-base-runtime-shell-v2'

export interface DualTopologyHostTestRuntime {
    readonly runtime: KernelRuntimeV2
    readonly localNodeId: NodeId
    start(): Promise<void>
    getState(): ReturnType<KernelRuntimeV2['getState']>
    dispatchCommand: KernelRuntimeV2['dispatchCommand']
    execute<TPayload = unknown>(input: {
        commandName: string
        payload: TPayload
        requestId?: RequestId
        commandId?: CommandId
    }): Promise<ReturnType<KernelRuntimeV2['dispatchCommand']> extends Promise<infer TResult> ? TResult : never>
    queryRequest: KernelRuntimeV2['queryRequest']
    applyRemoteCommandEvent: KernelRuntimeV2['applyRemoteCommandEvent']
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
    exportRequestLifecycleSnapshot(requestId: RequestId, sessionId?: SessionId): RequestLifecycleSnapshot | undefined
    createRemoteDispatchEnvelope<TPayload = unknown>(input: {
        requestId: RequestId
        sessionId: SessionId
        parentCommandId: CommandId
        targetNodeId: NodeId
        commandName: string
        payload: TPayload
        context?: CommandRouteContext
    }): CommandDispatchEnvelope
    handleRemoteDispatch(
        envelope: CommandDispatchEnvelope,
    ): Promise<{events: readonly CommandEventEnvelope[]}>
    getRequestProjection(requestId: RequestId): RequestProjection | undefined
}

export const selectRequestProjectionV2 = (
    runtime: Pick<DualTopologyHostTestRuntime, 'getRequestProjection'>,
    requestId: RequestId,
) => runtime.getRequestProjection(requestId)

const createTestLogger = (moduleName: string) => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write() {},
        scope: {
            moduleName,
            layer: 'kernel',
        },
    })
}

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        async getItem(key: string) {
            return saved.get(key) ?? null
        },
        async setItem(key: string, value: string) {
            saved.set(key, value)
        },
        async removeItem(key: string) {
            saved.delete(key)
        },
        async multiGet(keys: readonly string[]) {
            return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
        },
        async multiSet(entries: Readonly<Record<string, string>>) {
            Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
        },
        async multiRemove(keys: readonly string[]) {
            keys.forEach(key => saved.delete(key))
        },
        async getAllKeys() {
            return [...saved.keys()]
        },
        async clear() {
            saved.clear()
        },
    }
}

const toSnapshotCommandStatus = (
    command: NonNullable<ReturnType<KernelRuntimeV2['queryRequest']>>['commands'][number],
): 'started' | 'complete' | 'error' => {
    if (command.completedAt == null) {
        return 'started'
    }
    if (command.status === 'FAILED' || command.status === 'PARTIAL_FAILED' || command.status === 'TIMEOUT') {
        return 'error'
    }
    return 'complete'
}

const toSnapshotRequestStatus = (
    request: NonNullable<ReturnType<KernelRuntimeV2['queryRequest']>>,
): 'started' | 'complete' | 'error' => {
    if (request.status === 'COMPLETED') {
        return 'complete'
    }
    if (request.status === 'FAILED' || request.status === 'PARTIAL_FAILED' || request.status === 'TIMEOUT') {
        return 'error'
    }
    return 'started'
}

const toSnapshotError = (error: AppError | undefined) => {
    if (!error) {
        return undefined
    }
    return {
        name: error.name,
        key: error.key,
        code: error.code,
        message: error.message,
        category: error.category,
        severity: error.severity,
        createdAt: error.createdAt,
        details: error.details,
    }
}

const toProjection = (
    runtime: KernelRuntimeV2,
    requestId: RequestId,
): RequestProjection | undefined => {
    const query = runtime.queryRequest(requestId)
    if (!query) {
        return undefined
    }

    const resultsByCommand: RequestProjection['resultsByCommand'] = {}
    const errorsByCommand: RequestProjection['errorsByCommand'] = {}
    let mergedResults: Record<string, unknown> = {}
    let pendingCommandCount = 0

    query.commands.forEach(command => {
        const actorResultWithValue = command.actorResults.find(item => item.result !== undefined)
        const actorResultWithError = command.actorResults.find(item => item.error)

        if (command.completedAt == null) {
            pendingCommandCount += 1
        }

        if (actorResultWithValue?.result && typeof actorResultWithValue.result === 'object') {
            resultsByCommand[command.commandId] = actorResultWithValue.result as Record<string, unknown>
            mergedResults = {
                ...mergedResults,
                ...resultsByCommand[command.commandId],
            }
        }

        if (actorResultWithError?.error) {
            errorsByCommand[command.commandId] = {
                key: actorResultWithError.error.key,
                code: actorResultWithError.error.code,
                message: actorResultWithError.error.message,
            }
        }
    })

    return {
        requestId: query.requestId,
        ownerNodeId: runtime.localNodeId,
        status: query.status === 'COMPLETED'
            ? 'complete'
            : query.status === 'FAILED' || query.status === 'PARTIAL_FAILED' || query.status === 'TIMEOUT'
                ? 'error'
                : 'started',
        startedAt: query.startedAt as any,
        updatedAt: query.updatedAt as any,
        resultsByCommand,
        mergedResults,
        errorsByCommand,
        pendingCommandCount,
    }
}

const toLifecycleSnapshot = (
    runtime: KernelRuntimeV2,
    requestId: RequestId,
    sessionId?: SessionId,
): RequestLifecycleSnapshot | undefined => {
    const query = runtime.queryRequest(requestId)
    if (!query) {
        return undefined
    }
    return {
        requestId: query.requestId,
        ownerNodeId: runtime.localNodeId,
        rootCommandId: query.rootCommandId,
        sessionId,
        status: toSnapshotRequestStatus(query),
        startedAt: query.startedAt as any,
        updatedAt: query.updatedAt as any,
        commands: query.commands.map(command => {
            const resultActor = command.actorResults.find(item => item.result != null)
            const errorActor = command.actorResults.find(item => item.error != null)
            return {
                commandId: command.commandId,
                parentCommandId: command.parentCommandId,
                ownerNodeId: runtime.localNodeId,
                sourceNodeId: runtime.localNodeId,
                targetNodeId: command.target === 'peer'
                    ? ('peer' as NodeId)
                    : runtime.localNodeId,
                commandName: command.commandName,
                status: toSnapshotCommandStatus(command),
                result: resultActor?.result,
                error: toSnapshotError(errorActor?.error),
                startedAt: command.startedAt as any,
                updatedAt: (command.completedAt ?? command.startedAt) as any,
            }
        }),
        commandResults: query.commands
            .filter(command => command.completedAt != null)
            .map(command => {
                const resultActor = command.actorResults.find(item => item.result != null)
                const errorActor = command.actorResults.find(item => item.error != null)
                return {
                    commandId: command.commandId,
                    result: resultActor?.result,
                    error: toSnapshotError(errorActor?.error),
                    completedAt: command.completedAt as any,
                    erroredAt: errorActor?.completedAt as any,
                }
            }),
    }
}

const buildRemoteCommandDefinition = (commandName: string) =>
    defineCommand({
        moduleName: commandName.split('.').slice(0, -1).join('.'),
        commandName,
    })

export const createDualTopologyHostTestRuntime = (input: {
    localNodeId: NodeId
    modules?: readonly KernelRuntimeModuleV2[]
    loggerModuleName: string
}): DualTopologyHostTestRuntime => {
    const runtime = createKernelRuntimeV2({
        localNodeId: input.localNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createTestLogger(input.loggerModuleName),
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        }),
        modules: input.modules ?? [],
    })
    const suppressedProjectionRequestIds = new Set<RequestId>()

    const handleRemoteDispatch = async (envelope: CommandDispatchEnvelope) => {
        const events: CommandEventEnvelope[] = []
        suppressedProjectionRequestIds.add(envelope.requestId)

        events.push({
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: runtime.localNodeId,
            eventType: 'accepted',
            occurredAt: nowTimestampMs() as any,
        })

        const commandDefinition: CommandDefinition<any> = buildRemoteCommandDefinition(envelope.commandName)
        const result = await runtime.dispatchCommand(createCommand(commandDefinition, envelope.payload), {
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            parentCommandId: envelope.parentCommandId,
            target: 'local',
            routeContext: envelope.context,
        })

        events.push({
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: runtime.localNodeId,
            eventType: 'started',
            occurredAt: (result.actorResults[0]?.startedAt ?? nowTimestampMs()) as any,
        })

        const resultActor = result.actorResults.find(item => item.result != null)
        const errorActor = result.actorResults.find(item => item.error != null)
        events.push({
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: runtime.localNodeId,
            eventType: result.status === 'FAILED' || result.status === 'PARTIAL_FAILED' || result.status === 'TIMEOUT'
                ? 'failed'
                : 'completed',
            result: resultActor?.result,
            error: errorActor?.error
                ? {
                    key: errorActor.error.key,
                    code: errorActor.error.code,
                    message: errorActor.error.message,
                    details: errorActor.error.details,
                }
                : undefined,
            occurredAt: (result.completedAt ?? nowTimestampMs()) as any,
        })

        return {events}
    }

    return {
        runtime,
        localNodeId: runtime.localNodeId,
        start() {
            return runtime.start()
        },
        getState() {
            return runtime.getState()
        },
        dispatchCommand: runtime.dispatchCommand.bind(runtime),
        execute(inputValue) {
            return runtime.dispatchCommand(
                createCommand(buildRemoteCommandDefinition(inputValue.commandName), inputValue.payload),
                {
                    requestId: inputValue.requestId,
                    commandId: inputValue.commandId,
                    target: 'local',
                },
            )
        },
        queryRequest: runtime.queryRequest.bind(runtime),
        applyRemoteCommandEvent: runtime.applyRemoteCommandEvent.bind(runtime),
        applyRequestLifecycleSnapshot(snapshot) {
            runtime.applyRequestLifecycleSnapshot(snapshot)
        },
        exportRequestLifecycleSnapshot(requestId, sessionId) {
            return toLifecycleSnapshot(runtime, requestId, sessionId)
        },
        createRemoteDispatchEnvelope(dispatchInput) {
            const commandId = createCommandId()
            runtime.registerMirroredCommand({
                requestId: dispatchInput.requestId,
                commandId,
                parentCommandId: dispatchInput.parentCommandId,
                commandName: dispatchInput.commandName,
                target: 'peer',
                routeContext: dispatchInput.context,
            })
            return {
                envelopeId: createEnvelopeId(),
                sessionId: dispatchInput.sessionId,
                requestId: dispatchInput.requestId,
                commandId,
                parentCommandId: dispatchInput.parentCommandId,
                ownerNodeId: runtime.localNodeId,
                sourceNodeId: runtime.localNodeId,
                targetNodeId: dispatchInput.targetNodeId,
                commandName: dispatchInput.commandName,
                payload: dispatchInput.payload,
                context: dispatchInput.context ?? {},
                sentAt: nowTimestampMs(),
            }
        },
        handleRemoteDispatch,
        getRequestProjection(requestId) {
            if (suppressedProjectionRequestIds.has(requestId)) {
                return undefined
            }
            return toProjection(runtime, requestId)
        },
    }
}

export const createSilentRuntimeV2 = (localNodeId: NodeId) =>
    createDualTopologyHostTestRuntime({
        localNodeId,
        loggerModuleName: 'mock.server.dual-topology-host.test.runtime-v2.silent',
    })

export const createEchoModuleV2 = (): KernelRuntimeModuleV2 => {
    const echoCommand = defineCommand<Record<string, unknown>>({
        moduleName: 'mock.server.dual-topology-host.test.echo-module',
        commandName: 'mock.server.dual-topology-host.test.echo',
    })

    return {
        moduleName: 'mock.server.dual-topology-host.test.echo-module',
        packageVersion: '0.0.1',
        commandDefinitions: [echoCommand],
        actorDefinitions: [
            {
                moduleName: 'mock.server.dual-topology-host.test.echo-module',
                actorName: 'EchoActor',
                handlers: [
                    onCommand(echoCommand, context => ({
                        payload: context.command.payload,
                    })),
                ],
            },
        ],
    }
}
