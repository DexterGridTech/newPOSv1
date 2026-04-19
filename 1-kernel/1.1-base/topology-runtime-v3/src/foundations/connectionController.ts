import {createEnvelopeId, nowTimestampMs} from '@impos2/kernel-base-contracts'
import {createAppError} from '@impos2/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createSocketLifecycleController} from '@impos2/kernel-base-transport-runtime'
import {topologyRuntimeV3StateActions} from '../features/slices'
import {topologyRuntimeV3ErrorDefinitions, topologyRuntimeV3ParameterDefinitions} from '../supports'
import type {
    TopologyPeerOrchestratorV3,
    TopologyRuntimeV3Assembly,
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
    const socketBinding = input.assembly.resolveSocketBinding(input.context)
    if (!socketBinding) {
        throw createAppError(topologyRuntimeV3ErrorDefinitions.socketBindingRequired, {
            context: {
                nodeId: input.context.localNodeId,
            },
        })
    }

    const profile = socketBinding.profile ?? {
        ...topologyRuntimeV3SocketProfile,
        name: socketBinding.profileName || TOPOLOGY_RUNTIME_V3_SOCKET_PROFILE_NAME,
    }
    socketBinding.socketRuntime.registerProfile({
        ...profile,
        meta: {
            ...profile.meta,
            reconnectAttempts: input.reconnectAttemptsOverride ?? profile.meta.reconnectAttempts,
            reconnectDelayMs: resolveReconnectDelayMs(input.context, input.reconnectDelayMsOverride),
        },
    })

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

    const performSocketConnection = async () => {
        const currentState = socketBinding.socketRuntime.getConnectionState(socketBinding.profileName)
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

        await socketBinding.socketRuntime.connect(socketBinding.profileName)
        sendHello()
    }

    const lifecycle = createSocketLifecycleController({
        async connect() {
            await performSocketConnection()
        },
        disconnect(reason) {
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
        onDisconnected() {
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
                        status: message.envelope.snapshot.status,
                        payload: message.envelope.snapshot,
                    },
                },
            } as any))
            break
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
