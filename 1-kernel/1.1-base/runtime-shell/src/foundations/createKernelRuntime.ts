import {
    createAppError,
    createCommandId,
    createEnvelopeId,
    createRequestId,
    createRuntimeInstanceId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {
    AppError,
    AppModule,
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    ErrorCatalogEntry,
    ParameterCatalogEntry,
    ParameterDefinition,
    ProjectionMirrorEnvelope,
    RequestId,
    ResolvedErrorView,
    ResolvedParameter,
    SessionId,
    StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import {
    createDefinitionRegistryBundle,
    createDefinitionResolverBundle,
} from '@impos2/kernel-base-definition-registry'
import {
    createExecutionCommand,
    createExecutionRuntime,
    createInternalExecutionCommand,
    executionRuntimeErrorDefinitionList,
    type ExecutionContext,
    type ExecutionHandler,
    type ExecutionResult,
} from '@impos2/kernel-base-execution-runtime'
import type {ExecutionLifecycleEvent} from '@impos2/kernel-base-execution-runtime'
import {
    createTopologyRuntime,
    topologyRuntimeErrorDefinitionList,
} from '@impos2/kernel-base-topology-runtime'
import {
    applySliceSyncDiff,
    createStateRuntime,
    stateRuntimeErrorDefinitionList,
    stateRuntimeParameterDefinitionList,
} from '@impos2/kernel-base-state-runtime'
import {createRuntimeReadModel} from './readModel'
import {resolveRuntimeModules} from './moduleResolver'
import {
    runtimeShellErrorDefinitionList,
    runtimeShellErrorDefinitions,
} from '../supports'
import type {
    DispatchRuntimeCommandInput,
    KernelRuntimeActorHandler,
    KernelRuntimeHandler,
    KernelRuntimeModule,
    RuntimeModuleContext,
} from '../types/module'
import {runtimeShellCommandNames} from '../features/commands'
import type {
    CreateKernelRuntimeInput,
    CreateRemoteDispatchEnvelopeInput,
    HandleRemoteDispatchOptions,
    HandleRemoteDispatchResult,
    KernelRuntime,
} from '../types/runtime'

const toCatalogErrorEntry = (
    definition: NonNullable<AppModule['errorDefinitions']>[number],
): ErrorCatalogEntry => {
    return {
        key: definition.key,
        template: definition.defaultTemplate,
        updatedAt: nowTimestampMs(),
        source: 'default',
    }
}

const toCatalogParameterEntry = (
    definition: NonNullable<AppModule['parameterDefinitions']>[number],
): ParameterCatalogEntry => {
    return {
        key: definition.key,
        rawValue: definition.defaultValue,
        updatedAt: nowTimestampMs(),
        source: 'default',
    }
}

export const createKernelRuntime = (
    input: CreateKernelRuntimeInput,
): KernelRuntime => {
    const runtimeId = input.runtimeId ?? createRuntimeInstanceId()
    const persistencePrefix = `kernel-runtime:${input.localNodeId}`
    const modules = resolveRuntimeModules(input.modules)
    const appStateSlices = modules.flatMap(module => [...(module.stateSlices ?? [])])
    const registries = createDefinitionRegistryBundle()
    const topology = createTopologyRuntime({
        localNodeId: input.localNodeId,
        localProtocolVersion: input.localProtocolVersion,
        localCapabilities: input.localCapabilities,
        localRuntimeVersion: input.localRuntimeVersion,
        stateStorage: input.platformPorts.stateStorage,
        secureStateStorage: input.platformPorts.secureStateStorage,
        persistenceKey: `${persistencePrefix}:topology`,
        allowPersistence: true,
        logger: input.platformPorts.logger.scope({
            moduleName: 'kernel.base.topology-runtime',
            subsystem: 'topology',
        }),
    })
    const readModel = createRuntimeReadModel(
        runtimeId,
        {
            logger: input.platformPorts.logger.scope({
                moduleName: 'kernel.base.runtime-shell',
                subsystem: 'state-runtime',
            }),
            stateStorage: input.platformPorts.stateStorage,
            secureStateStorage: input.platformPorts.secureStateStorage,
            persistenceKey: `${persistencePrefix}:read-model`,
            allowPersistence: true,
        },
    )
    const appStateRuntime = createStateRuntime({
        runtimeName: 'runtime-shell.app-state',
        logger: input.platformPorts.logger.scope({
            moduleName: 'kernel.base.runtime-shell',
            subsystem: 'app-state',
        }),
        stateStorage: input.platformPorts.stateStorage,
        secureStateStorage: input.platformPorts.secureStateStorage,
        persistenceKey: `${persistencePrefix}:app-state`,
        allowPersistence: true,
        slices: appStateSlices,
    })
    const moduleContexts = new Map<string, RuntimeModuleContext>()
    const actorHandlers = new Map<string, Array<{
        moduleName: string
        handler: KernelRuntimeActorHandler
    }>>()
    let started = false
    const internalErrorDefinitions = [
        ...executionRuntimeErrorDefinitionList,
        ...stateRuntimeErrorDefinitionList,
        ...topologyRuntimeErrorDefinitionList,
        ...runtimeShellErrorDefinitionList,
    ]
    const internalParameterDefinitions = [
        ...stateRuntimeParameterDefinitionList,
    ]

    const createResolverBundle = () => createDefinitionResolverBundle(registries, {
        errorCatalog: readModel.getState().errorCatalog,
        parameterCatalog: readModel.getState().parameterCatalog,
    })

    const syncProjection = (requestId: RequestId) => {
        const projection = topology.getRequestProjection(requestId)
        if (projection) {
            readModel.setRequestProjection(requestId, projection)
        }
    }

    const applyLifecycleToTopology = (
        event: ExecutionLifecycleEvent,
        error?: AppError,
        result?: Record<string, unknown>,
    ) => {
        topology.applyCommandEvent({
            envelopeId: createEnvelopeId(),
            sessionId: 'INTERNAL' as SessionId,
            requestId: event.requestId,
            commandId: event.commandId,
            ownerNodeId: input.localNodeId,
            sourceNodeId: input.localNodeId,
            eventType:
                event.eventType === 'started'
                    ? 'started'
                    : event.eventType === 'completed'
                        ? 'completed'
                        : 'failed',
            result,
            error: error
                ? {
                    key: error.key,
                    code: error.code,
                    message: error.message,
                    details: error.details,
                }
                : undefined,
            occurredAt: event.occurredAt,
        })
    }

    const applyProjectionMirror = (envelope: ProjectionMirrorEnvelope) => {
        readModel.applyProjectionMirror(envelope)
    }

    const buildRootCommand = <TPayload>(
        commandInput: DispatchRuntimeCommandInput<TPayload>,
    ) => {
        const requestId = commandInput.requestId ?? createRequestId()
        const commandId = createCommandId()

        const command = commandInput.internal
            ? createInternalExecutionCommand({
                commandId,
                requestId,
                sessionId: commandInput.sessionId,
                commandName: commandInput.commandName,
                payload: commandInput.payload,
                context: commandInput.context,
            })
            : createExecutionCommand({
                commandId,
                requestId,
                sessionId: commandInput.sessionId,
                commandName: commandInput.commandName,
                payload: commandInput.payload,
                context: commandInput.context,
            })

        topology.registerRootRequest({
            requestId,
            rootCommandId: command.commandId,
            ownerNodeId: input.localNodeId,
            sourceNodeId: input.localNodeId,
            commandName: command.commandName,
        })

        syncProjection(requestId)
        return command
    }

    const executePreparedCommand = async (
        command: ReturnType<typeof createExecutionCommand>,
    ): Promise<ExecutionResult> => {
        let result: ExecutionResult

        try {
            result = await execution.execute(command)
        } catch (error) {
            const appError = createAppError(runtimeShellErrorDefinitions.executeFailed, {
                args: {commandName: command.commandName},
                context: {
                    commandName: command.commandName,
                    commandId: command.commandId,
                    requestId: command.requestId,
                    sessionId: command.sessionId,
                    nodeId: input.localNodeId,
                },
                cause: error,
            })

            applyLifecycleToTopology(
                {
                    eventType: 'failed',
                    commandId: command.commandId,
                    requestId: command.requestId,
                    commandName: command.commandName,
                    internal: command.internal === true,
                    occurredAt: nowTimestampMs(),
                },
                appError,
            )

            syncProjection(command.requestId)

            return {
                status: 'failed',
                error: appError,
            }
        }

        if (result.status === 'completed') {
            applyLifecycleToTopology(
                {
                    eventType: 'completed',
                    commandId: command.commandId,
                    requestId: command.requestId,
                    commandName: command.commandName,
                    internal: command.internal === true,
                    occurredAt: nowTimestampMs(),
                },
                undefined,
                result.result,
            )
        } else {
            applyLifecycleToTopology(
                {
                    eventType: 'failed',
                    commandId: command.commandId,
                    requestId: command.requestId,
                    commandName: command.commandName,
                    internal: command.internal === true,
                    occurredAt: nowTimestampMs(),
                },
                result.error,
            )
        }

        syncProjection(command.requestId)
        return result
    }

    const execution = createExecutionRuntime({
        logger: input.platformPorts.logger.scope({
            moduleName: 'kernel.base.runtime-shell',
            subsystem: 'execution',
        }),
        onLifecycleEvent(event: ExecutionLifecycleEvent) {
            if (event.eventType === 'started') {
                if (!topology.hasTrackedCommand(event.requestId, event.commandId)) {
                    return
                }
                applyLifecycleToTopology(event)
                syncProjection(event.requestId)
            }
        },
    })

    const ensureStarted = () => {
        if (!started) {
            throw new Error('KernelRuntime has not started yet')
        }
    }

    const buildModuleContext = (module: KernelRuntimeModule): RuntimeModuleContext => {
        const existing = moduleContexts.get(module.moduleName)
        if (existing) {
            return existing
        }

        const context: RuntimeModuleContext = {
            runtimeId,
            localNodeId: input.localNodeId,
            moduleName: module.moduleName,
            platformPorts: input.platformPorts,
            registries,
            topology,
            getState: () => appStateRuntime.getState(),
            getStore: () => appStateRuntime.getStore(),
            dispatchAction: action => appStateRuntime.getStore().dispatch(action),
            subscribeState: listener => appStateRuntime.getStore().subscribe(listener),
            createRemoteDispatchEnvelope,
            handleRemoteDispatch,
            applyRemoteCommandEvent,
            applyRequestLifecycleSnapshot: snapshot => {
                topology.applyRequestLifecycleSnapshot(snapshot)
                syncProjection(snapshot.requestId)
            },
            applyProjectionMirror,
            getRequestProjection: requestId => readModel.getState().requestProjections[requestId],
            listTrackedRequestIds: filter => topology.listTrackedRequestIds(filter),
            resolveParameter: inputValue => {
                if (inputValue.definition) {
                    return createResolverBundle().resolveParameter({
                        definition: inputValue.definition as ParameterDefinition<unknown>,
                    }) as ResolvedParameter<any>
                }
                return createResolverBundle().resolveParameterByKey(inputValue.key) as ResolvedParameter<any>
            },
            getSyncSlices: () => appStateRuntime.getSlices().filter(slice => Boolean(slice.sync)),
            applyStateSyncDiff: envelope => {
                const state = appStateRuntime.getState() as Record<string, unknown>
                const nextSlices: Record<string, unknown> = {}

                for (const slice of appStateRuntime.getSlices()) {
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
                    appStateRuntime.applySlicePatches(nextSlices)
                }
            },
            publishActor: async inputValue => {
                const handlers = actorHandlers.get(inputValue.actorName) ?? []
                if (handlers.length === 0) {
                    return
                }

                for (const actor of handlers) {
                    try {
                        await actor.handler({
                            ...buildModuleContext(modules.find(item => item.moduleName === actor.moduleName)!),
                            actorName: inputValue.actorName,
                            payload: inputValue.payload,
                        })
                    } catch (error) {
                        throw createAppError(runtimeShellErrorDefinitions.actorPublishFailed, {
                            args: {actorName: inputValue.actorName},
                            context: {
                                nodeId: input.localNodeId,
                            },
                            details: {
                                moduleName: actor.moduleName,
                            },
                            cause: error,
                        })
                    }
                }
            },
        }

        moduleContexts.set(module.moduleName, context)
        return context
    }

    const registerReadModelHandlers = () => {
        execution.registerHandler(
            runtimeShellCommandNames.upsertErrorCatalogEntries,
            async executionContext => {
                const payload = (executionContext.command.payload ?? {}) as {
                    entries?: readonly ErrorCatalogEntry[]
                }
                payload.entries?.forEach(entry => {
                    readModel.setErrorCatalogEntry(entry)
                })
                return {
                    count: payload.entries?.length ?? 0,
                }
            },
        )

        execution.registerHandler(
            runtimeShellCommandNames.removeErrorCatalogEntries,
            async executionContext => {
                const payload = (executionContext.command.payload ?? {}) as {
                    keys?: readonly string[]
                }
                payload.keys?.forEach(key => {
                    readModel.removeErrorCatalogEntry(key)
                })
                return {
                    count: payload.keys?.length ?? 0,
                }
            },
        )

        execution.registerHandler(
            runtimeShellCommandNames.upsertParameterCatalogEntries,
            async executionContext => {
                const payload = (executionContext.command.payload ?? {}) as {
                    entries?: readonly ParameterCatalogEntry[]
                }
                payload.entries?.forEach(entry => {
                    readModel.setParameterCatalogEntry(entry)
                })
                return {
                    count: payload.entries?.length ?? 0,
                }
            },
        )

        execution.registerHandler(
            runtimeShellCommandNames.removeParameterCatalogEntries,
            async executionContext => {
                const payload = (executionContext.command.payload ?? {}) as {
                    keys?: readonly string[]
                }
                payload.keys?.forEach(key => {
                    readModel.removeParameterCatalogEntry(key)
                })
                return {
                    count: payload.keys?.length ?? 0,
                }
            },
        )
    }

    const registerModuleHandler = (
        module: KernelRuntimeModule,
        commandName: string,
        handler: KernelRuntimeHandler,
    ) => {
        const moduleContext = buildModuleContext(module)

        const wrappedHandler: ExecutionHandler = async (executionContext: ExecutionContext) => {
            return handler({
                ...moduleContext,
                command: executionContext.command,
                dispatchChild: childInput => {
                    const childCommandId = createCommandId()
                    const childCommand = childInput.internal
                        ? createInternalExecutionCommand({
                            commandId: childCommandId,
                            requestId: executionContext.command.requestId,
                            sessionId: childInput.sessionId ?? executionContext.command.sessionId,
                            commandName: childInput.commandName,
                            payload: childInput.payload,
                            context: childInput.context,
                            parentCommandId: executionContext.command.commandId,
                        })
                        : createExecutionCommand({
                            commandId: childCommandId,
                            requestId: executionContext.command.requestId,
                            sessionId: childInput.sessionId ?? executionContext.command.sessionId,
                            commandName: childInput.commandName,
                            payload: childInput.payload,
                            context: childInput.context,
                            parentCommandId: executionContext.command.commandId,
                        })

                    topology.registerChildDispatch({
                        envelopeId: createEnvelopeId(),
                        sessionId: (childCommand.sessionId ?? ('INTERNAL' as SessionId)),
                        requestId: childCommand.requestId,
                        commandId: childCommand.commandId,
                        parentCommandId: executionContext.command.commandId,
                        ownerNodeId: input.localNodeId,
                        sourceNodeId: input.localNodeId,
                        targetNodeId: input.localNodeId,
                        commandName: childCommand.commandName,
                        payload: childCommand.payload,
                        context: childCommand.context ?? {},
                        sentAt: nowTimestampMs(),
                    })

                    syncProjection(childCommand.requestId)
                    return executePreparedCommand(childCommand)
                },
            })
        }

        execution.registerHandler(commandName, wrappedHandler)
    }

    const registerModuleActor = (
        module: KernelRuntimeModule,
        actorName: string,
        handler: KernelRuntimeActorHandler,
    ) => {
        const current = actorHandlers.get(actorName) ?? []
        current.push({
            moduleName: module.moduleName,
            handler,
        })
        actorHandlers.set(actorName, current)
    }

    const execute = async <TPayload = unknown>(
        commandInput: DispatchRuntimeCommandInput<TPayload>,
    ): Promise<ExecutionResult> => {
        ensureStarted()
        const command = buildRootCommand(commandInput)
        return executePreparedCommand(command)
    }

    const createRemoteDispatchEnvelope = <TPayload = unknown>(
        dispatchInput: CreateRemoteDispatchEnvelopeInput<TPayload>,
    ): CommandDispatchEnvelope => {
        ensureStarted()
        const commandId = createCommandId()
        const envelope: CommandDispatchEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: dispatchInput.sessionId,
            requestId: dispatchInput.requestId,
            commandId,
            parentCommandId: dispatchInput.parentCommandId,
            ownerNodeId: input.localNodeId,
            sourceNodeId: input.localNodeId,
            targetNodeId: dispatchInput.targetNodeId,
            commandName: dispatchInput.commandName,
            payload: dispatchInput.payload,
            context: dispatchInput.context ?? {},
            sentAt: nowTimestampMs(),
        }
        topology.registerChildDispatch(envelope)
        syncProjection(dispatchInput.requestId)
        return envelope
    }

    const handleRemoteDispatch = async (
        envelope: CommandDispatchEnvelope,
        options?: HandleRemoteDispatchOptions,
    ): Promise<HandleRemoteDispatchResult> => {
        ensureStarted()

        const command = createExecutionCommand({
            commandId: envelope.commandId,
            requestId: envelope.requestId,
            sessionId: envelope.sessionId,
            commandName: envelope.commandName,
            payload: envelope.payload,
            context: envelope.context,
            parentCommandId: envelope.parentCommandId,
        })

        const events: CommandEventEnvelope[] = []
        const emitRemoteEvent = (event: CommandEventEnvelope) => {
            events.push(event)
            options?.onEvent?.(event)
        }

        emitRemoteEvent({
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: input.localNodeId,
            eventType: 'accepted',
            occurredAt: nowTimestampMs(),
        })

        const result = await execution.execute(command, {
            onLifecycleEvent(event) {
                if (event.commandId !== envelope.commandId) {
                    return
                }
                if (event.eventType === 'started') {
                    emitRemoteEvent({
                        envelopeId: createEnvelopeId(),
                        sessionId: envelope.sessionId,
                        requestId: envelope.requestId,
                        commandId: envelope.commandId,
                        ownerNodeId: envelope.ownerNodeId,
                        sourceNodeId: input.localNodeId,
                        eventType: 'started',
                        occurredAt: event.occurredAt,
                    })
                }
            },
        })

        if (result.status === 'completed') {
            emitRemoteEvent({
                envelopeId: createEnvelopeId(),
                sessionId: envelope.sessionId,
                requestId: envelope.requestId,
                commandId: envelope.commandId,
                ownerNodeId: envelope.ownerNodeId,
                sourceNodeId: input.localNodeId,
                eventType: 'completed',
                result: result.result,
                occurredAt: nowTimestampMs(),
            })
        } else {
            emitRemoteEvent({
                envelopeId: createEnvelopeId(),
                sessionId: envelope.sessionId,
                requestId: envelope.requestId,
                commandId: envelope.commandId,
                ownerNodeId: envelope.ownerNodeId,
                sourceNodeId: input.localNodeId,
                eventType: 'failed',
                error: {
                    key: result.error.key,
                    code: result.error.code,
                    message: result.error.message,
                    details: result.error.details,
                },
                occurredAt: nowTimestampMs(),
            })
        }

        return {events}
    }

    const applyRemoteCommandEvent = (envelope: CommandEventEnvelope) => {
        ensureStarted()
        topology.applyCommandEvent(envelope)
        syncProjection(envelope.requestId)
    }

    const start = async () => {
        if (started) {
            return
        }

        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'kernel-runtime-start',
            message: 'start kernel runtime',
            data: {
                runtimeId,
                localNodeId: input.localNodeId,
            },
        })

        await topology.hydrate()
        await appStateRuntime.hydratePersistence()
        await readModel.hydrate()
        registerReadModelHandlers()

        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'kernel-runtime-modules-resolved',
            message: 'resolved kernel runtime modules',
            data: {
                modules: modules.map(module => ({
                    moduleName: module.moduleName,
                    packageVersion: module.packageVersion,
                    commandCount: module.commands?.length ?? 0,
                    actorCount: module.actors?.length ?? 0,
                    sliceCount: module.slices?.length ?? module.stateSlices?.length ?? 0,
                    stateSliceCount: module.stateSlices?.length ?? 0,
                    errorDefinitionCount: module.errorDefinitions?.length ?? 0,
                    parameterDefinitionCount: module.parameterDefinitions?.length ?? 0,
                })),
            },
        })

        if (input.startupSeed?.requestProjections || input.startupSeed?.errorCatalog || input.startupSeed?.parameterCatalog) {
            input.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-startup-seed',
                message: 'apply runtime startup seed',
                data: {
                    requestProjectionCount: Object.keys(input.startupSeed?.requestProjections ?? {}).length,
                    errorCatalogCount: Object.keys(input.startupSeed?.errorCatalog ?? {}).length,
                    parameterCatalogCount: Object.keys(input.startupSeed?.parameterCatalog ?? {}).length,
                },
            })

            readModel.replaceState({
                runtimeId,
                requestProjections: {
                    ...(input.startupSeed?.requestProjections ?? {}),
                },
                errorCatalog: {
                    ...(input.startupSeed?.errorCatalog ?? {}),
                },
                parameterCatalog: {
                    ...(input.startupSeed?.parameterCatalog ?? {}),
                },
            })
        }

        internalErrorDefinitions.forEach(definition => {
            if (!registries.errors.has(definition.key)) {
                registries.errors.register(definition)
            }
            if (!readModel.getState().errorCatalog[definition.key]) {
                readModel.setErrorCatalogEntry(toCatalogErrorEntry(definition))
            }
        })

        internalParameterDefinitions.forEach(definition => {
            if (!registries.parameters.has(definition.key)) {
                registries.parameters.register(definition)
            }
            if (!readModel.getState().parameterCatalog[definition.key]) {
                readModel.setParameterCatalogEntry(toCatalogParameterEntry(definition))
            }
        })

        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'kernel-runtime-host-bootstrap',
            message: 'host bootstrap modules',
            data: {
                modules: modules.filter(module => module.hostBootstrap).map(module => module.moduleName),
            },
        })

        for (const module of modules) {
            await module.hostBootstrap?.(buildModuleContext(module))
        }

        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'kernel-runtime-install',
            message: 'install modules',
            data: {
                modules: modules.filter(module => module.install).map(module => module.moduleName),
            },
        })

        for (const module of modules) {
            module.errorDefinitions?.forEach(definition => {
                registries.errors.register(definition)
                if (!readModel.getState().errorCatalog[definition.key]) {
                    readModel.setErrorCatalogEntry(toCatalogErrorEntry(definition))
                }
            })

            module.parameterDefinitions?.forEach(definition => {
                registries.parameters.register(definition)
                if (!readModel.getState().parameterCatalog[definition.key]) {
                    readModel.setParameterCatalogEntry(toCatalogParameterEntry(definition))
                }
            })

            await module.install?.({
                ...buildModuleContext(module),
                registerHandler(commandName, handler) {
                    registerModuleHandler(module, commandName, handler)
                },
                registerActor(actorName, handler) {
                    registerModuleActor(module, actorName, handler)
                },
            })
        }

        started = true

        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'kernel-runtime-initialize-commands',
            message: 'execute module initialize commands',
            data: {
                commands: modules.flatMap(module =>
                    (module.initializeCommands ?? []).map(command => ({
                        moduleName: module.moduleName,
                        commandName: command.commandName,
                    })),
                ),
            },
        })

        for (const module of modules) {
            for (const initializeCommand of module.initializeCommands ?? []) {
                await execute({
                    commandName: initializeCommand.commandName,
                    payload: initializeCommand.payload ?? {},
                    requestId: initializeCommand.requestId,
                    sessionId: initializeCommand.sessionId,
                    context: initializeCommand.context,
                    internal: true,
                })
            }
        }
    }

    return {
        runtimeId,
        modules,
        start,
        async flushPersistence() {
            ensureStarted()
            await topology.flushPersistence()
            await appStateRuntime.flushPersistence()
            await readModel.flush()
        },
        execute,
        createRemoteDispatchEnvelope,
        handleRemoteDispatch,
        applyRemoteCommandEvent,
        exportRequestLifecycleSnapshot(requestId, sessionId) {
            return topology.exportRequestLifecycleSnapshot(requestId, sessionId)
        },
        applyRequestLifecycleSnapshot(snapshot) {
            topology.applyRequestLifecycleSnapshot(snapshot)
            syncProjection(snapshot.requestId)
        },
        applyProjectionMirror,
        listTrackedRequestIds(inputFilter) {
            return topology.listTrackedRequestIds(inputFilter)
        },
        getState() {
            return {
                ...appStateRuntime.getState(),
                ...readModel.getState(),
            }
        },
        getRequestProjection(requestId) {
            return readModel.getState().requestProjections[requestId]
        },
        getErrorCatalogEntry(key) {
            return readModel.getState().errorCatalog[key]
        },
        getParameterCatalogEntry(key) {
            return readModel.getState().parameterCatalog[key]
        },
        resolveError(key) {
            ensureStarted()
            return createResolverBundle().resolveErrorByKey({key})
        },
        resolveAppError(inputValue) {
            ensureStarted()
            const definition = registries.errors.get(inputValue.key)
            const appError: AppError = {
                name: definition?.name ?? inputValue.key,
                key: inputValue.key,
                code: inputValue.code ?? definition?.code ?? inputValue.key,
                message: inputValue.message ?? definition?.defaultTemplate ?? inputValue.key,
                category: definition?.category ?? 'UNKNOWN',
                severity: definition?.severity ?? 'MEDIUM',
                createdAt: nowTimestampMs(),
                details: inputValue.details,
                args: inputValue.args,
            }
            return createResolverBundle().resolveAppError({appError})
        },
        resolveParameter(inputValue) {
            ensureStarted()
            if (inputValue.definition) {
                return createResolverBundle().resolveParameter({
                    definition: inputValue.definition as ParameterDefinition<unknown>,
                }) as ResolvedParameter<any>
            }
            return createResolverBundle().resolveParameterByKey(inputValue.key) as ResolvedParameter<any>
        },
        getSubsystems() {
            return {
                registries,
                execution,
                topology,
            }
        },
    }
}
