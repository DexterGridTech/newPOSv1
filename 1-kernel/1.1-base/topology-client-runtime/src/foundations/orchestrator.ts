import {
    createEnvelopeId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {
    CommandEventEnvelope,
    RequestProjection,
    RequestLifecycleSnapshotEnvelope,
    StateSyncCommitAckEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {SyncStateSummary} from '@impos2/kernel-base-state-runtime'
import type {SocketEvent} from '@impos2/kernel-base-transport-runtime'
import {
    topologyClientStateActions,
} from '../features/slices'
import type {
    TopologyClientAssembly,
    DispatchRemoteCommandInput,
    DispatchRemoteCommandResult,
    TopologyClientIncomingMessage,
    TopologyClientOutgoingMessage,
    TopologyClientRuntimeInstallContext,
    TopologyClientSessionContext,
} from '../types'

export interface TopologyClientOrchestrator {
    startConnection(): Promise<void>
    stopConnection(reason?: string): void
    restartConnection(reason?: string): Promise<void>
    beginResume(requestIds?: readonly string[]): void
    dispatchRemoteCommand<TPayload = unknown>(input: DispatchRemoteCommandInput<TPayload>): Promise<DispatchRemoteCommandResult>
    sendRemoteDispatch(message: Extract<TopologyClientOutgoingMessage, {type: 'command-dispatch'}>): void
    sendCommandEvent(message: Extract<TopologyClientOutgoingMessage, {type: 'command-event'}>): void
    sendRequestLifecycleSnapshot(envelope: RequestLifecycleSnapshotEnvelope): void
    getSessionContext(): TopologyClientSessionContext
}

const deriveWorkspace = (runtime?: {role?: string}) => runtime?.role === 'slave' ? 'BRANCH' : 'MAIN'

const resolvePeerFromAck = (
    ack: Extract<TopologyClientIncomingMessage, {type: 'node-hello-ack'}>['ack'],
) => {
    const peer = ack.peerRuntime
    if (!peer) {
        return {}
    }
    return {
        peerNodeId: peer.nodeId,
        peerDeviceId: peer.deviceId,
        peerInstanceMode: peer.role === 'slave' ? 'SLAVE' : 'MASTER',
        peerDisplayMode: peer.role === 'slave' ? 'SECONDARY' : 'PRIMARY',
        peerWorkspace: deriveWorkspace(peer),
        connectedAt: nowTimestampMs(),
    }
}

const isMessageEvent = (
    event: SocketEvent<TopologyClientIncomingMessage>,
): event is Extract<SocketEvent<TopologyClientIncomingMessage>, {type: 'message'}> => {
    return event.type === 'message'
}

const isReconnectingEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'reconnecting'}> => {
    return event.type === 'reconnecting'
}

const isErrorEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'error'}> => {
    return event.type === 'error'
}

const resolveSyncDirection = (input: {
    localInstanceMode?: string
    peerRole?: string
}): 'master-to-slave' | 'slave-to-master' => {
    if (input.localInstanceMode === 'SLAVE' || input.peerRole === 'master') {
        return 'master-to-slave'
    }
    return 'slave-to-master'
}

export const createTopologyClientOrchestrator = (
    input: {
        context: TopologyClientRuntimeInstallContext
        assembly: TopologyClientAssembly
    },
): TopologyClientOrchestrator => {
    const binding = input.assembly.resolveSocketBinding(input.context)
    const sessionContext: TopologyClientSessionContext = {}
    let listenersAttached = false

    if (binding?.profile) {
        binding.socketRuntime.registerProfile(binding.profile)
    }

    const dispatchConnectionPatch = (
        patch: Parameters<typeof topologyClientStateActions.patchTopologyClientConnection>[0],
    ) => {
        input.context.dispatchAction(topologyClientStateActions.patchTopologyClientConnection(patch))
    }

    const dispatchSyncPatch = (
        patch: Parameters<typeof topologyClientStateActions.patchTopologyClientSync>[0],
    ) => {
        input.context.dispatchAction(topologyClientStateActions.patchTopologyClientSync(patch))
    }

    const send = (message: TopologyClientOutgoingMessage) => {
        if (!binding) {
            throw new Error('Topology client socket binding is not available')
        }
        binding.socketRuntime.send(binding.profileName, message)
    }

    const sendResumeArtifacts = (inputArtifacts: {
        sessionId: string
        targetNodeId?: string
        requestIds?: readonly string[]
    }) => {
        if (!inputArtifacts.targetNodeId) {
            return
        }

        const trackedRequestIds = input.context.listTrackedRequestIds({
            peerNodeId: inputArtifacts.targetNodeId as any,
        })
        const mergedRequestIds = Array.from(new Set([
            ...trackedRequestIds,
            ...(inputArtifacts.requestIds ?? []),
            ...(input.assembly.getResumeSnapshotRequestIds?.(input.context) ?? []),
        ]))

        for (const requestId of mergedRequestIds) {
            const snapshot = input.context.topology.exportRequestLifecycleSnapshot(
                requestId as any,
                inputArtifacts.sessionId as any,
            )
            if (!snapshot) {
                continue
            }

            const envelope: RequestLifecycleSnapshotEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId: inputArtifacts.sessionId as any,
                requestId: snapshot.requestId,
                ownerNodeId: snapshot.ownerNodeId,
                sourceNodeId: input.context.localNodeId as any,
                targetNodeId: inputArtifacts.targetNodeId as any,
                snapshot,
                sentAt: nowTimestampMs(),
            }
            send({
                type: 'request-lifecycle-snapshot',
                envelope,
            })
        }

        const syncDirection = resolveSyncDirection({
            localInstanceMode: input.context.topology.getRecoveryState().instanceMode,
            peerRole: sessionContext.peerRuntime?.role,
        })
        input.context.topology.beginSyncSession({
            sessionId: inputArtifacts.sessionId as any,
            peerNodeId: inputArtifacts.targetNodeId as any,
            direction: syncDirection,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
            startedAt: nowTimestampMs() as any,
        })

        const summaryEnvelope: StateSyncSummaryEnvelope | undefined = input.context.topology.createSyncSummaryEnvelope({
            envelopeId: createEnvelopeId(),
            sessionId: inputArtifacts.sessionId as any,
            sourceNodeId: input.context.localNodeId as any,
            targetNodeId: inputArtifacts.targetNodeId as any,
        })

        if (summaryEnvelope) {
            send({
                type: 'state-sync-summary',
                envelope: summaryEnvelope,
            })
            dispatchSyncPatch({
                lastSummarySentAt: summaryEnvelope.sentAt,
            })
        }
    }

    const waitForRemoteCommandStarted = async (
        requestId: string,
        commandId: string,
        timeoutMs = 2_000,
    ): Promise<RequestProjection> => {
        const startedAt = Date.now()

        while (true) {
            const projection = input.context.getRequestProjection(requestId as any)
            const command = input.context
                .topology
                .exportRequestLifecycleSnapshot(requestId as any)
                ?.commands
                .find(item => item.commandId === commandId)

            if (projection && command?.status === 'started') {
                return projection
            }

            if (Date.now() - startedAt > timeoutMs) {
                throw new Error(`Timed out waiting for remote command started: ${commandId}`)
            }

            await new Promise(resolve => setTimeout(resolve, 10))
        }
    }

    const beginResume = (requestIds?: readonly string[]) => {
        if (!sessionContext.sessionId) {
            return
        }

        const startedAt = nowTimestampMs()
        dispatchSyncPatch({
            resumeStatus: 'active',
            activeSessionId: sessionContext.sessionId,
        })

        send({
            type: 'resume-begin',
            sessionId: sessionContext.sessionId,
            nodeId: input.context.localNodeId,
            timestamp: startedAt,
        })

        sendResumeArtifacts({
            sessionId: sessionContext.sessionId,
            targetNodeId: sessionContext.peerRuntime?.nodeId,
            requestIds,
        })

        send({
            type: 'resume-complete',
            sessionId: sessionContext.sessionId,
            nodeId: input.context.localNodeId,
            timestamp: nowTimestampMs(),
        })

        dispatchConnectionPatch({
            lastResumeAt: nowTimestampMs(),
        })
    }

    const applyStateSyncSummary = (message: Extract<TopologyClientIncomingMessage, {type: 'state-sync-summary'}>) => {
        input.context.topology.beginSyncSession({
            sessionId: message.envelope.sessionId,
            peerNodeId: message.envelope.sourceNodeId,
            direction: message.envelope.direction,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
            startedAt: message.envelope.sentAt as any,
        })
        const diff = input.context.topology.handleSyncSummaryEnvelope({
            envelope: message.envelope,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
            receivedAt: nowTimestampMs(),
        })
        if (!diff) {
            return
        }
        send({
            type: 'state-sync-diff',
            envelope: diff,
        })
        dispatchSyncPatch({
            lastDiffAppliedAt: nowTimestampMs(),
        })
    }

    const applyStateSyncDiff = (message: Extract<TopologyClientIncomingMessage, {type: 'state-sync-diff'}>) => {
        const committedAt = nowTimestampMs()
        input.context.applyStateSyncDiff(message.envelope)
        input.context.topology.activateContinuousSync({
            sessionId: message.envelope.sessionId,
            direction: message.envelope.direction,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
            activatedAt: committedAt as any,
        })
        const ack: StateSyncCommitAckEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: message.envelope.sessionId,
            sourceNodeId: message.envelope.targetNodeId,
            targetNodeId: message.envelope.sourceNodeId,
            committedAt,
        }
        send({
            type: 'state-sync-commit-ack',
            envelope: ack,
        })
        dispatchSyncPatch({
            lastDiffAppliedAt: committedAt,
            lastCommitAckAt: committedAt,
        })
    }

    const applyStateSyncCommitAck = (message: Extract<TopologyClientIncomingMessage, {type: 'state-sync-commit-ack'}>) => {
        const session = input.context.topology.getSyncSession(message.envelope.sessionId)
        const currentSummary: Record<string, SyncStateSummary> = Object.fromEntries(
            (session?.localSummary ?? []).map(entry => [entry.sliceName, entry.summary]),
        )
        input.context.topology.handleSyncCommitAckEnvelope({
            envelope: message.envelope,
            currentSummary,
        })
        dispatchSyncPatch({
            lastCommitAckAt: message.envelope.committedAt,
            continuousSyncActive: true,
            resumeStatus: 'completed',
        })
    }

    const onMessage = (event: SocketEvent<TopologyClientIncomingMessage>) => {
        if (!isMessageEvent(event)) {
            return
        }

        const message = event.message
        if (message.type === '__host_heartbeat') {
            send({
                type: '__host_heartbeat_ack',
                timestamp: message.timestamp,
            })
            return
        }

        if (message.type === 'node-hello-ack') {
            sessionContext.sessionId = message.ack.sessionId
            sessionContext.peerRuntime = message.ack.peerRuntime
            if (!message.ack.accepted || !message.ack.sessionId) {
                dispatchConnectionPatch({
                    serverConnectionStatus: 'DISCONNECTED',
                    connectionError: message.ack.rejectionMessage ?? message.ack.rejectionCode ?? 'hello rejected',
                    disconnectedAt: nowTimestampMs(),
                })
                return
            }

            input.context.dispatchAction(topologyClientStateActions.patchTopologyClientPeer(resolvePeerFromAck(message.ack)))
            dispatchConnectionPatch({
                serverConnectionStatus: 'CONNECTED',
                connectedAt: nowTimestampMs(),
                connectionError: undefined,
                lastHelloAt: message.ack.hostTime,
            })
            dispatchSyncPatch({
                activeSessionId: message.ack.sessionId,
            })
            beginResume()
            return
        }

        if (message.type === 'resume-begin') {
            sendResumeArtifacts({
                sessionId: message.sessionId,
                targetNodeId: message.nodeId,
            })
            return
        }

        if (message.type === 'command-dispatch') {
            void input.context
                .handleRemoteDispatch(message.envelope, {
                    onEvent(eventEnvelope) {
                        send({
                            type: 'command-event',
                            envelope: eventEnvelope,
                        })
                    },
                })
                .then((result: {events: readonly CommandEventEnvelope[]}) => {
                    if (result.events.length === 0) {
                        return
                    }
                })
            return
        }

        if (message.type === 'command-event') {
            input.context.applyRemoteCommandEvent(message.envelope)
            return
        }

        if (message.type === 'request-lifecycle-snapshot') {
            input.context.applyRequestLifecycleSnapshot(message.envelope.snapshot)
            return
        }

        if (message.type === 'state-sync-summary') {
            applyStateSyncSummary(message)
            return
        }

        if (message.type === 'state-sync-diff') {
            applyStateSyncDiff(message)
            return
        }

        if (message.type === 'state-sync-commit-ack') {
            applyStateSyncCommitAck(message)
        }
    }

    const onConnected = () => {
        const hello = input.assembly.createHello(input.context)
        if (!hello) {
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                connectionError: 'hello unavailable',
                disconnectedAt: nowTimestampMs(),
            })
            return
        }

        send({
            type: 'node-hello',
            hello,
        })
    }

    const attachListeners = () => {
        if (!binding || listenersAttached) {
            return
        }

        listenersAttached = true

        binding.socketRuntime.on(binding.profileName, 'message', onMessage)
        binding.socketRuntime.on(binding.profileName, 'disconnected', event => {
            sessionContext.sessionId = undefined
            sessionContext.peerRuntime = undefined
            input.context.dispatchAction(topologyClientStateActions.replaceTopologyClientPeer({}))
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: event.occurredAt,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                activeSessionId: undefined,
                continuousSyncActive: false,
            })
        })
        binding.socketRuntime.on(binding.profileName, 'reconnecting', event => {
            if (!isReconnectingEvent(event)) {
                return
            }
            dispatchConnectionPatch({
                serverConnectionStatus: 'CONNECTING',
                reconnectAttempt: event.attempt,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                continuousSyncActive: false,
            })
        })
        binding.socketRuntime.on(binding.profileName, 'error', event => {
            if (!isErrorEvent(event)) {
                return
            }
            dispatchConnectionPatch({
                connectionError: event.error instanceof Error ? event.error.message : String(event.error),
            })
        })
    }

    const dispatchRemoteCommand = async <TPayload = unknown>(
        dispatchInput: DispatchRemoteCommandInput<TPayload>,
    ): Promise<DispatchRemoteCommandResult> => {
        if (!sessionContext.sessionId) {
            throw new Error('Topology client session is not active')
        }

        const envelope = input.context.createRemoteDispatchEnvelope({
            requestId: dispatchInput.requestId,
            sessionId: sessionContext.sessionId,
            parentCommandId: dispatchInput.parentCommandId,
            targetNodeId: dispatchInput.targetNodeId,
            commandName: dispatchInput.commandName,
            payload: dispatchInput.payload,
        })

        send({
            type: 'command-dispatch',
            envelope,
        })

        const projection = await waitForRemoteCommandStarted(
            dispatchInput.requestId,
            envelope.commandId,
        )

        return {
            requestId: dispatchInput.requestId,
            commandId: envelope.commandId,
            sessionId: sessionContext.sessionId,
            targetNodeId: dispatchInput.targetNodeId,
            startedAt: projection.updatedAt,
        }
    }

    const startConnection = async () => {
        if (!binding) {
            return
        }

        attachListeners()

        dispatchConnectionPatch({
            serverConnectionStatus: 'CONNECTING',
            reconnectAttempt: 0,
            connectionError: undefined,
        })

        try {
            await binding.socketRuntime.connect(binding.profileName)
            onConnected()
        } catch (error) {
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
                connectionError: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return {
        startConnection,
        stopConnection(reason) {
            sessionContext.sessionId = undefined
            sessionContext.peerRuntime = undefined
            input.context.dispatchAction(topologyClientStateActions.replaceTopologyClientPeer({}))
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
            })
            dispatchSyncPatch({
                resumeStatus: 'idle',
                activeSessionId: undefined,
                continuousSyncActive: false,
            })
            binding?.socketRuntime.disconnect(binding.profileName, reason)
        },
        async restartConnection(reason) {
            sessionContext.sessionId = undefined
            sessionContext.peerRuntime = undefined
            input.context.dispatchAction(topologyClientStateActions.replaceTopologyClientPeer({}))
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
            })
            dispatchSyncPatch({
                resumeStatus: 'idle',
                activeSessionId: undefined,
                continuousSyncActive: false,
            })
            binding?.socketRuntime.disconnect(binding.profileName, reason)
            await startConnection()
        },
        beginResume,
        dispatchRemoteCommand,
        sendRemoteDispatch(message) {
            send(message)
        },
        sendCommandEvent(message) {
            send(message)
        },
        sendRequestLifecycleSnapshot(envelope) {
            send({
                type: 'request-lifecycle-snapshot',
                envelope,
            })
        },
        getSessionContext() {
            return {...sessionContext}
        },
    }
}
