import {
    createEnvelopeId,
    createRequestId,
    nowTimestampMs,
    type CommandEventEnvelope,
    type CommandRouteContext,
    type RequestId,
    type SessionId,
} from '@next/kernel-base-contracts'
import {createAppError, isAppError} from '@next/kernel-base-contracts'
import {
    createCommand,
    defineCommand,
    type CommandAggregateResult,
    type RuntimeModuleContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {createSocketLifecycleController} from '@next/kernel-base-transport-runtime'
import {topologyRuntimeV3StateActions} from '../features/slices'
import {topologyRuntimeV3ErrorDefinitions, topologyRuntimeV3ParameterDefinitions} from '../supports'
import type {
    TopologyPeerOrchestratorV3,
    TopologyRuntimeV3Assembly,
    TopologyRuntimeV3SocketBinding,
    TopologyV3CommandDispatchMessage,
    TopologyV3CommandEventMessage,
    TopologyV3HelloAckMessage,
    TopologyV3IncomingMessage,
} from '../types/runtime'
import {applyTopologyV3HelloAck, markTopologyV3PairDisconnected} from './pairLinkController'
import {TOPOLOGY_RUNTIME_V3_SOCKET_PROFILE_NAME, topologyRuntimeV3SocketProfile} from './protocol'
import {
    getTopologyV3InboundDirection,
    createTopologyV3SnapshotMessage,
    createTopologyV3StateDiffEnvelopeFromSnapshot,
    createTopologyV3StateDiffEnvelopeFromUpdate,
    createTopologyV3SingleSliceUpdateMessage,
} from './syncRegistry'

const getRuntimeDirection = (
    context: RuntimeModuleContextV2,
): 'master-to-slave' | 'slave-to-master' => {
    const contextState = context.getState()?.[
        'kernel.base.topology-runtime-v3.context' as keyof ReturnType<typeof context.getState>
    ] as {instanceMode?: 'MASTER' | 'SLAVE'} | undefined
    return getTopologyV3InboundDirection({
        instanceMode: contextState?.instanceMode === 'SLAVE' ? 'SLAVE' : 'MASTER',
    })
}

const isMessageEvent = (
    event: {type: string},
): event is Extract<{type: string}, {type: 'message'}> => event.type === 'message'

const isDisconnectedEvent = (
    event: {type: string},
): event is Extract<{type: string}, {type: 'disconnected'}> => event.type === 'disconnected'

const isErrorEvent = (
    event: {type: string},
): event is Extract<{type: string}, {type: 'error'}> => event.type === 'error'

const normalizeRequestMirrorStatus = (status: string) =>
    status === 'complete' ? 'completed' : status

const createRemoteCommandDefinition = (commandName: string) =>
    defineCommand({
        moduleName: 'kernel.base.topology-runtime-v3.remote-dispatch',
        commandName,
    })

const toTopologyCommandError = (error: unknown) => {
    if (isAppError(error)) {
        return {
            key: error.key,
            code: error.code,
            message: error.message,
            details: error.details,
        }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
        key: 'kernel.base.topology-runtime-v3.remote_command_failed',
        code: 'TOPOLOGY_REMOTE_COMMAND_FAILED',
        message,
        details: error,
    }
}

const createPendingRemoteCommandKey = (requestId: RequestId, commandId: string) =>
    `${requestId}:${commandId}`

const resolveReconnectDelayMs = (context: RuntimeModuleContextV2, override?: number) => {
    if (typeof override === 'number' && Number.isFinite(override) && override >= 0) {
        return override
    }
    const parameterCatalog = context.getState()?.[
        'kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>
    ] as Record<string, {rawValue?: unknown}> | undefined
    const value = parameterCatalog?.[topologyRuntimeV3ParameterDefinitions.reconnectIntervalMs.key]?.rawValue
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value
    }
    return topologyRuntimeV3ParameterDefinitions.reconnectIntervalMs.defaultValue
}

const applyHelloAckToState = (
    context: RuntimeModuleContextV2,
    ack: TopologyV3HelloAckMessage,
) => {
    const connectionState = context.getState()?.[
        'kernel.base.topology-runtime-v3.connection' as keyof ReturnType<typeof context.getState>
    ] as any
    const peerState = context.getState()?.[
        'kernel.base.topology-runtime-v3.peer' as keyof ReturnType<typeof context.getState>
    ] as any
    const syncState = context.getState()?.[
        'kernel.base.topology-runtime-v3.sync' as keyof ReturnType<typeof context.getState>
    ] as any

    const projected = applyTopologyV3HelloAck({
        connectionStatus: connectionState?.serverConnectionStatus ?? 'DISCONNECTED',
        peer: peerState ?? {},
        sync: syncState ?? {status: 'idle'},
    }, ack, nowTimestampMs())

    context.dispatchAction(topologyRuntimeV3StateActions.patchConnectionState({
        serverConnectionStatus: projected.connectionStatus,
        reconnectAttempt: 0,
    }))
    context.dispatchAction(topologyRuntimeV3StateActions.replacePeerState(projected.peer))
    context.dispatchAction(topologyRuntimeV3StateActions.replaceSyncState(projected.sync))
}

const applyDisconnectToState = (
    context: RuntimeModuleContextV2,
    reconnectAttempt: number,
) => {
    const peerState = context.getState()?.[
        'kernel.base.topology-runtime-v3.peer' as keyof ReturnType<typeof context.getState>
    ] as any
    const syncState = context.getState()?.[
        'kernel.base.topology-runtime-v3.sync' as keyof ReturnType<typeof context.getState>
    ] as any
    const projected = markTopologyV3PairDisconnected({
        connectionStatus: 'DISCONNECTED',
        peer: peerState ?? {},
        sync: syncState ?? {status: 'idle'},
    }, nowTimestampMs())

    context.dispatchAction(topologyRuntimeV3StateActions.patchConnectionState({
        serverConnectionStatus: 'DISCONNECTED',
        reconnectAttempt,
    }))
    context.dispatchAction(topologyRuntimeV3StateActions.replacePeerState(projected.peer))
    context.dispatchAction(topologyRuntimeV3StateActions.replaceSyncState(projected.sync))
}

export const createTopologyPeerOrchestratorV3 = (input: {
    context: RuntimeModuleContextV2
    assembly: TopologyRuntimeV3Assembly
    reconnectAttemptsOverride?: number
    reconnectDelayMsOverride?: number
}): TopologyPeerOrchestratorV3 => {
    const initialSocketBinding = input.assembly.resolveSocketBinding(input.context)
    if (!initialSocketBinding) {
        throw createAppError(topologyRuntimeV3ErrorDefinitions.socketBindingRequired, {
            context: {
                nodeId: input.context.localNodeId,
            },
        })
    }

    const createProfile = (socketBinding: TopologyRuntimeV3SocketBinding) => socketBinding.profile ?? {
        ...topologyRuntimeV3SocketProfile,
        name: socketBinding.profileName || TOPOLOGY_RUNTIME_V3_SOCKET_PROFILE_NAME,
    }
    const registerSocketBinding = (
        socketBinding: TopologyRuntimeV3SocketBinding,
    ): TopologyRuntimeV3SocketBinding => {
        const profile = createProfile(socketBinding)
        socketBinding.socketRuntime.registerProfile({
            ...profile,
            meta: {
                ...profile.meta,
                reconnectAttempts: input.reconnectAttemptsOverride ?? profile.meta.reconnectAttempts,
                reconnectDelayMs: resolveReconnectDelayMs(input.context, input.reconnectDelayMsOverride),
            },
        })
        return {
            ...socketBinding,
            profileName: profile.name,
            profile,
        }
    }
    let socketBinding = registerSocketBinding(initialSocketBinding)
    const pendingRemoteCommands = new Map<string, {
        commandId: string
        resolve: (result: CommandAggregateResult) => void
        reject: (error: unknown) => void
    }>()
    const rejectPendingRemoteCommands = (reason: string) => {
        if (pendingRemoteCommands.size === 0) {
            return
        }
        const error = createAppError(topologyRuntimeV3ErrorDefinitions.orchestratorRequired, {
            details: {
                reason,
                pendingCount: pendingRemoteCommands.size,
            },
        })
        for (const pending of pendingRemoteCommands.values()) {
            pending.reject(error)
        }
        pendingRemoteCommands.clear()
    }
    const refreshSocketBinding = () => {
        const latestSocketBinding = input.assembly.resolveSocketBinding(input.context)
        if (!latestSocketBinding) {
            throw createAppError(topologyRuntimeV3ErrorDefinitions.socketBindingRequired, {
                context: {
                    nodeId: input.context.localNodeId,
                },
            })
        }
        socketBinding = registerSocketBinding(latestSocketBinding)
        return socketBinding
    }

    const profile = {
        ...socketBinding.profile!,
        meta: {
            ...socketBinding.profile!.meta,
            reconnectAttempts: input.reconnectAttemptsOverride ?? socketBinding.profile!.meta.reconnectAttempts,
            reconnectDelayMs: resolveReconnectDelayMs(input.context, input.reconnectDelayMsOverride),
        },
    }

    const sendHello = () => {
        const runtime = input.assembly.createHelloRuntime(input.context)
        if (!runtime) {
            throw createAppError(topologyRuntimeV3ErrorDefinitions.helloRuntimeRequired, {
                context: {
                    nodeId: input.context.localNodeId,
                },
            })
        }
        socketBinding.socketRuntime.send(socketBinding.profileName, {
            type: 'hello',
            helloId: createEnvelopeId(),
            runtime,
            sentAt: nowTimestampMs(),
        })
        input.context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
            status: 'connecting',
        }))
    }

    let previousState = input.context.getState()

    const resolveActiveSessionId = () => {
        const syncState = input.context.getState()?.[
            'kernel.base.topology-runtime-v3.sync' as keyof ReturnType<typeof input.context.getState>
        ] as {activeSessionId?: SessionId; status?: string} | undefined
        return syncState?.status === 'active' ? syncState.activeSessionId : undefined
    }

    const resolvePeerNodeId = () => {
        const peerState = input.context.getState()?.[
            'kernel.base.topology-runtime-v3.peer' as keyof ReturnType<typeof input.context.getState>
        ] as {peerNodeId?: string} | undefined
        return peerState?.peerNodeId
    }

    const sendRemoteCommandEvent = (message: TopologyV3CommandEventMessage) => {
        socketBinding.socketRuntime.send(socketBinding.profileName, message)
    }

    const dispatchIncomingRemoteCommand = async (message: TopologyV3CommandDispatchMessage) => {
        const envelope = message.envelope
        const acceptEnvelope: CommandEventEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: input.context.localNodeId,
            eventType: 'accepted',
            occurredAt: nowTimestampMs(),
        }
        sendRemoteCommandEvent({
            type: 'command-event',
            envelope: acceptEnvelope,
        })

        const startedEnvelope: CommandEventEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: envelope.sessionId,
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            ownerNodeId: envelope.ownerNodeId,
            sourceNodeId: input.context.localNodeId,
            eventType: 'started',
            occurredAt: nowTimestampMs(),
        }
        sendRemoteCommandEvent({
            type: 'command-event',
            envelope: startedEnvelope,
        })

        try {
            const result = await input.context.dispatchCommand(
                createCommand(createRemoteCommandDefinition(envelope.commandName), envelope.payload),
                {
                    requestId: envelope.requestId,
                    commandId: envelope.commandId,
                    parentCommandId: envelope.parentCommandId,
                    routeContext: envelope.context as CommandRouteContext,
                },
            )
            sendRemoteCommandEvent({
                type: 'command-event',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: envelope.sessionId,
                    requestId: envelope.requestId,
                    commandId: envelope.commandId,
                    ownerNodeId: envelope.ownerNodeId,
                    sourceNodeId: input.context.localNodeId,
                    eventType: result.status === 'FAILED' || result.status === 'PARTIAL_FAILED' || result.status === 'TIMEOUT'
                        ? 'failed'
                        : 'completed',
                    result: {
                        requestId: result.requestId,
                        commandId: result.commandId,
                        commandName: result.commandName,
                        target: result.target,
                        status: result.status,
                        startedAt: result.startedAt,
                        completedAt: result.completedAt,
                        actorResults: result.actorResults as unknown as Record<string, unknown>[],
                    },
                    error: result.status === 'FAILED' || result.status === 'PARTIAL_FAILED' || result.status === 'TIMEOUT'
                        ? {
                            key: 'kernel.base.topology-runtime-v3.remote_command_failed',
                            code: 'TOPOLOGY_REMOTE_COMMAND_FAILED',
                            message: `Remote command ${result.commandName} finished with ${result.status}`,
                            details: {
                                status: result.status,
                                actorResults: result.actorResults,
                            },
                        }
                        : undefined,
                    occurredAt: nowTimestampMs(),
                },
            })
        } catch (error) {
            sendRemoteCommandEvent({
                type: 'command-event',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: envelope.sessionId,
                    requestId: envelope.requestId,
                    commandId: envelope.commandId,
                    ownerNodeId: envelope.ownerNodeId,
                    sourceNodeId: input.context.localNodeId,
                    eventType: 'failed',
                    error: toTopologyCommandError(error),
                    occurredAt: nowTimestampMs(),
                },
            })
        }
    }

    const performSocketConnection = async () => {
        const currentBinding = refreshSocketBinding()
        const currentState = currentBinding.socketRuntime.getConnectionState(currentBinding.profileName)
        const stateRecord = input.context.getState() as Record<string, unknown>
        const syncState = stateRecord['kernel.base.topology-runtime-v3.sync'] as {
            activeSessionId?: string
            status?: string
        } | undefined
        const needsHelloResume = currentState === 'connected'
            && (!syncState?.activeSessionId || syncState.status !== 'active')
        if (currentState === 'connected' || currentState === 'connecting') {
            if (needsHelloResume) {
                input.context.dispatchAction(topologyRuntimeV3StateActions.patchConnectionState({
                    serverConnectionStatus: 'CONNECTING',
                }))
                sendHello()
            }
            return
        }

        input.context.dispatchAction(topologyRuntimeV3StateActions.patchConnectionState({
            serverConnectionStatus: 'CONNECTING',
        }))
        input.context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
            status: 'connecting',
        }))

        await currentBinding.socketRuntime.connect(currentBinding.profileName)
        sendHello()
    }

    const lifecycle = createSocketLifecycleController({
        async connect() {
            await performSocketConnection()
        },
        disconnect(reason) {
            rejectPendingRemoteCommands(reason ?? 'topology-disconnected')
            socketBinding.socketRuntime.disconnect(socketBinding.profileName, reason)
        },
        attachListeners(handlers) {
            socketBinding.socketRuntime.on(socketBinding.profileName, 'connected', () => {
                handlers.connected()
            })
            socketBinding.socketRuntime.on(socketBinding.profileName, 'disconnected', event => {
                if (!isDisconnectedEvent(event as any)) {
                    return
                }
                handlers.disconnected((event as any).reason)
            })
            socketBinding.socketRuntime.on(socketBinding.profileName, 'error', event => {
                if (!isErrorEvent(event as any)) {
                    return
                }
                handlers.error((event as any).error)
            })
        },
        resolveReconnectPolicy() {
            return {
                attempts: input.reconnectAttemptsOverride ?? profile.meta.reconnectAttempts ?? -1,
                delayMs: resolveReconnectDelayMs(input.context, input.reconnectDelayMsOverride),
            }
        },
        shouldReconnect() {
            return true
        },
        shouldReconnectOnConnectError(error) {
            if (!isAppError(error)) {
                return true
            }
            return error.key === 'kernel.base.transport-runtime.socket_runtime_failed'
        },
        onDisconnected() {
            rejectPendingRemoteCommands('topology-disconnected')
            applyDisconnectToState(input.context, lifecycle.getReconnectAttempt())
        },
        onReconnectScheduled({attempt}) {
            input.context.dispatchAction(topologyRuntimeV3StateActions.patchConnectionState({
                serverConnectionStatus: 'DISCONNECTED',
                reconnectAttempt: attempt,
            }))
            input.context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
                status: 'connecting',
            }))
        },
    })

    socketBinding.socketRuntime.on<TopologyV3IncomingMessage>(socketBinding.profileName, 'message', event => {
        if (!isMessageEvent(event as any)) {
            return
        }
        const message = (event as any).message as TopologyV3IncomingMessage
        switch (message.type) {
        case 'hello-ack':
            applyHelloAckToState(input.context, message)
            lifecycle.resetReconnectAttempt()
            if (message.accepted && message.sessionId) {
                const contextState = input.context.getState()?.[
                    'kernel.base.topology-runtime-v3.context' as keyof ReturnType<typeof input.context.getState>
                ] as any
                const snapshot = createTopologyV3SnapshotMessage({
                    sessionId: message.sessionId,
                    sourceNodeId: String(input.context.localNodeId),
                    targetNodeId: message.peerRuntime?.nodeId ? String(message.peerRuntime.nodeId) : undefined,
                    context: contextState,
                    slices: input.context.getSyncSlices(),
                    state: input.context.getState(),
                })
                if (snapshot.entries.length > 0) {
                    socketBinding.socketRuntime.send(socketBinding.profileName, snapshot)
                }
            }
            break
        case 'state-snapshot':
            input.context.applyStateSyncDiff(createTopologyV3StateDiffEnvelopeFromSnapshot({
                message,
                localNodeId: String(input.context.localNodeId),
                direction: getRuntimeDirection(input.context),
            }))
            input.context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
                activeSessionId: message.sessionId,
                status: 'active',
                lastSnapshotAppliedAt: nowTimestampMs(),
            }))
            break
        case 'state-update':
            input.context.applyStateSyncDiff(createTopologyV3StateDiffEnvelopeFromUpdate({
                message,
                localNodeId: String(input.context.localNodeId),
                direction: getRuntimeDirection(input.context),
            }))
            input.context.dispatchAction(topologyRuntimeV3StateActions.patchSyncState({
                activeSessionId: message.sessionId,
                status: 'active',
            }))
            break
        case 'request-snapshot':
            input.context.dispatchAction(topologyRuntimeV3StateActions.patchRequestMirrorState({
                requests: {
                    ...(input.context.getState()?.[
                        'kernel.base.topology-runtime-v3.request-mirror' as keyof ReturnType<typeof input.context.getState>
                    ] as any)?.requests,
                    [message.envelope.snapshot.requestId]: {
                        requestId: message.envelope.snapshot.requestId,
                        status: normalizeRequestMirrorStatus(message.envelope.snapshot.status),
                        payload: message.envelope.snapshot,
                    },
                },
            } as any))
            break
        case 'command-dispatch':
            void dispatchIncomingRemoteCommand(message)
            break
        case 'command-event': {
            input.context.applyRemoteCommandEvent(message.envelope)
            const commandResult = message.envelope.result as CommandAggregateResult | undefined
            const pendingKey = createPendingRemoteCommandKey(message.envelope.requestId, message.envelope.commandId)
            const pending = pendingRemoteCommands.get(pendingKey)
            if (
                pending
                && pending.commandId === message.envelope.commandId
                && (message.envelope.eventType === 'completed' || message.envelope.eventType === 'failed')
            ) {
                pendingRemoteCommands.delete(pendingKey)
                if (message.envelope.eventType === 'completed' && commandResult) {
                    pending.resolve(commandResult)
                } else if (commandResult) {
                    pending.resolve(commandResult)
                } else {
                    pending.reject(message.envelope.error ?? new Error('Remote command failed'))
                }
            }
            break
        }
        default:
            break
        }
    })
    input.context.subscribeState(() => {
        const currentState = input.context.getState()
        const currentStateRecord = currentState as Record<string, unknown>
        const syncState = currentStateRecord['kernel.base.topology-runtime-v3.sync'] as any
        const peerState = currentStateRecord['kernel.base.topology-runtime-v3.peer'] as {
            peerNodeId?: string
        } | undefined
        if (!syncState?.activeSessionId || syncState.status !== 'active') {
            previousState = currentState
            return
        }

        for (const slice of input.context.getSyncSlices()) {
            if (!(slice.name in currentStateRecord)) {
                continue
            }
            const contextState = currentStateRecord['kernel.base.topology-runtime-v3.context'] as {
                instanceMode?: 'MASTER' | 'SLAVE'
            } | undefined
            const update = createTopologyV3SingleSliceUpdateMessage({
                sessionId: syncState.activeSessionId,
                sourceNodeId: String(input.context.localNodeId),
                targetNodeId: peerState?.peerNodeId ? String(peerState.peerNodeId) : undefined,
                context: {
                    instanceMode: contextState?.instanceMode === 'SLAVE' ? 'SLAVE' : 'MASTER',
                },
                slice,
                currentState,
                previousState,
            })
            if (update) {
                socketBinding.socketRuntime.send(socketBinding.profileName, update)
            }
        }
        previousState = currentState
    })
    lifecycle.attach()

    return {
        async startConnection() {
            await lifecycle.start()
        },
        stopConnection(reason?: string) {
            lifecycle.stop(reason)
        },
        async restartConnection(reason?: string) {
            await lifecycle.restart(reason)
        },
        async dispatchRemoteCommand(inputCommand) {
            const sessionId = resolveActiveSessionId()
            const targetNodeId = resolvePeerNodeId()
            if (!sessionId || !targetNodeId) {
                throw createAppError(topologyRuntimeV3ErrorDefinitions.orchestratorRequired, {
                    args: {
                        commandName: inputCommand.commandName,
                    },
                    details: {
                        reason: 'peer-session-not-ready',
                        sessionId,
                        targetNodeId,
                    },
                })
            }

            return await new Promise<CommandAggregateResult>((resolve, reject) => {
                const requestId = inputCommand.requestId ?? createRequestId()
                const pendingKey = createPendingRemoteCommandKey(requestId, inputCommand.commandId)
                pendingRemoteCommands.set(pendingKey, {
                    commandId: inputCommand.commandId,
                    resolve,
                    reject,
                })

                try {
                    socketBinding.socketRuntime.send(socketBinding.profileName, {
                        type: 'command-dispatch',
                        envelope: {
                            envelopeId: createEnvelopeId(),
                            sessionId,
                            requestId,
                            commandId: inputCommand.commandId,
                            parentCommandId: inputCommand.parentCommandId,
                            ownerNodeId: input.context.localNodeId,
                            sourceNodeId: input.context.localNodeId,
                            targetNodeId,
                            commandName: inputCommand.commandName,
                            payload: inputCommand.payload,
                            context: (inputCommand.routeContext ?? {}) as CommandRouteContext,
                            sentAt: nowTimestampMs(),
                        },
                    })
                } catch (error) {
                    pendingRemoteCommands.delete(pendingKey)
                    reject(error)
                }
            })
        },
        sendStateSnapshot(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
        sendStateUpdate(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
        sendCommandDispatch(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
        sendCommandEvent(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
        sendRequestSnapshot(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
        sendProjectionMirror(message) {
            socketBinding.socketRuntime.send(socketBinding.profileName, message)
        },
    }
}
