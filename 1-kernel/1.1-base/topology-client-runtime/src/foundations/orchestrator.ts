import {
    createAppError,
    createEnvelopeId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {
    CommandEventEnvelope,
    RequestProjection,
    ProjectionMirrorEnvelope,
    RequestLifecycleSnapshotEnvelope,
    StateSyncCommitAckEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import {createSliceSyncSummary, type SyncStateSummary} from '@impos2/kernel-base-state-runtime'
import {defineSocketProfile, type SocketEvent} from '@impos2/kernel-base-transport-runtime'
import {topologyClientStateActions} from '../features/slices'
import {topologyClientErrorDefinitions, topologyClientParameterDefinitions} from '../supports'
import {TOPOLOGY_CLIENT_SYNC_STATE_KEY} from './stateKeys'
import type {
    DispatchRemoteCommandInput,
    DispatchRemoteCommandResult,
    TopologyClientAssembly,
    TopologyClientIncomingMessage,
    TopologyClientOutgoingMessage,
    TopologyClientRuntimeInstallContext,
    TopologyClientSessionContext,
    TopologyClientSocketBinding,
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
    sendProjectionMirror(envelope: ProjectionMirrorEnvelope): void
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
): event is Extract<SocketEvent<TopologyClientIncomingMessage>, {type: 'message'}> => event.type === 'message'

const isErrorEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'error'}> => event.type === 'error'

const isDisconnectedEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'disconnected'}> => event.type === 'disconnected'

const resolveSyncDirection = (input: {
    localInstanceMode?: string
    peerRole?: string
}): 'master-to-slave' | 'slave-to-master' => {
    if (input.localInstanceMode === 'SLAVE' || input.peerRole === 'master') {
        return 'master-to-slave'
    }
    return 'slave-to-master'
}

const isAuthorityForDirection = (input: {
    localInstanceMode?: string
    direction: 'master-to-slave' | 'slave-to-master'
}) => {
    const localInstanceMode = input.localInstanceMode ?? 'MASTER'
    if (input.direction === 'master-to-slave') {
        return localInstanceMode === 'MASTER'
    }
    return localInstanceMode === 'SLAVE'
}

const shouldAutoConnectOnBoot = (context: TopologyClientRuntimeInstallContext) => {
    const recoveryState = context.topology.getRecoveryState()
    return recoveryState.instanceMode === 'SLAVE'
        ? Boolean(recoveryState.masterInfo)
        : recoveryState.enableSlave === true
}

const createResolvedBinding = (
    binding: TopologyClientSocketBinding | undefined,
    context: TopologyClientRuntimeInstallContext,
    reconnectAttemptsOverride?: number,
): TopologyClientSocketBinding | undefined => {
    if (!binding?.profile) {
        return binding
    }

    const connectionTimeoutMs = context.resolveParameter<number>({
        key: topologyClientParameterDefinitions.serverConnectionTimeoutMs.key,
    }).value
    const heartbeatTimeoutMs = context.resolveParameter<number>({
        key: topologyClientParameterDefinitions.serverHeartbeatTimeoutMs.key,
    }).value
    const reconnectDelayMs = context.resolveParameter<number>({
        key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
    }).value
    const reconnectAttempts = reconnectAttemptsOverride
        ?? context.resolveParameter<number>({
            key: topologyClientParameterDefinitions.serverReconnectAttempts.key,
        }).value

    return {
        ...binding,
        profile: defineSocketProfile({
            name: binding.profile.name,
            serverName: binding.profile.serverName,
            pathTemplate: binding.profile.pathTemplate,
            handshake: binding.profile.handshake,
            messages: binding.profile.messages,
            codec: binding.profile.codec,
            meta: {
                ...binding.profile.meta,
                connectionTimeoutMs,
                heartbeatTimeoutMs,
                reconnectDelayMs,
                reconnectAttempts,
            },
        }),
    }
}

export const createTopologyClientOrchestrator = (
    input: {
        context: TopologyClientRuntimeInstallContext
        assembly: TopologyClientAssembly
        reconnectAttemptsOverride?: number
    },
): TopologyClientOrchestrator => {
    const binding = createResolvedBinding(
        input.assembly.resolveSocketBinding(input.context),
        input.context,
        input.reconnectAttemptsOverride,
    )
    const sessionContext: TopologyClientSessionContext = {}
    let listenersAttached = false
    let stateUnsubscribe: (() => void) | undefined
    let lastContinuousDiffSignature = ''
    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manualStop = false
    let connectionToken = 0
    const pendingCommitSummaryByDirection = new Map<
        'master-to-slave' | 'slave-to-master',
        Record<string, SyncStateSummary>
    >()

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

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return
        }
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
    }

    const getReconnectDelayMs = () => {
        return input.context.resolveParameter<number>({
            key: topologyClientParameterDefinitions.serverReconnectIntervalMs.key,
        }).value
    }

    const getReconnectAttempts = () => {
        return binding?.profile?.meta?.reconnectAttempts
            ?? input.context.resolveParameter<number>({
                key: topologyClientParameterDefinitions.serverReconnectAttempts.key,
            }).value
    }

    const getRemoteCommandResponseTimeoutMs = () => {
        return input.context.resolveParameter<number>({
            key: topologyClientParameterDefinitions.remoteCommandResponseTimeoutMs.key,
        }).value
    }

    const getRemoteCommandResponsePollIntervalMs = () => {
        return input.context.resolveParameter<number>({
            key: topologyClientParameterDefinitions.remoteCommandResponsePollIntervalMs.key,
        }).value
    }

    const createSocketBindingUnavailableError = (commandName: string) => {
        return createAppError(topologyClientErrorDefinitions.socketBindingUnavailable, {
                args: {
                commandName,
                },
            })
    }

    const send = (message: TopologyClientOutgoingMessage) => {
        if (!binding) {
            throw createSocketBindingUnavailableError(message.type)
        }
        binding.socketRuntime.send(binding.profileName, message)
    }

    const resetSessionState = (disconnectedAt: number, resumeStatus: 'idle' | 'pending') => {
        sessionContext.sessionId = undefined
        sessionContext.peerRuntime = undefined
        lastContinuousDiffSignature = ''
        pendingCommitSummaryByDirection.clear()
        input.context.dispatchAction(topologyClientStateActions.replaceTopologyClientPeer({}))
        dispatchConnectionPatch({
            serverConnectionStatus: 'DISCONNECTED',
            disconnectedAt,
        })
        dispatchSyncPatch({
            resumeStatus,
            activeSessionId: undefined,
            continuousSyncActive: false,
        })
    }

    const scheduleReconnect = (reason: string) => {
        if (!binding || disposed || manualStop) {
            return
        }
        if (!shouldAutoConnectOnBoot(input.context)) {
            return
        }
        if (reconnectTimer) {
            return
        }

        const maxAttempts = getReconnectAttempts()
        if (maxAttempts >= 0 && reconnectAttempt >= maxAttempts) {
            return
        }

        reconnectAttempt += 1
        const reconnectDelayMs = getReconnectDelayMs()
        dispatchConnectionPatch({
            serverConnectionStatus: 'CONNECTING',
            reconnectAttempt,
            connectionError: reason,
        })
        dispatchSyncPatch({
            resumeStatus: 'pending',
            continuousSyncActive: false,
        })

        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined
            void startConnection({isReconnect: true})
        }, reconnectDelayMs)
    }

    const getContinuousDirection = (): 'master-to-slave' | 'slave-to-master' => {
        return resolveSyncDirection({
            localInstanceMode: input.context.topology.getRecoveryState().instanceMode,
            peerRole: sessionContext.peerRuntime?.role,
        })
    }

    const getAuthoritativeDirection = (): 'master-to-slave' | 'slave-to-master' => {
        return input.context.topology.getRecoveryState().instanceMode === 'SLAVE'
            ? 'slave-to-master'
            : 'master-to-slave'
    }

    const buildCurrentSummaryByDirection = (
        direction: 'master-to-slave' | 'slave-to-master',
    ): Record<string, SyncStateSummary> => {
        const state = input.context.getState() as Record<string, unknown>
        const summaryBySlice: Record<string, SyncStateSummary> = {}

        for (const slice of input.context.getSyncSlices()) {
            if (!slice.sync || slice.syncIntent !== direction) {
                continue
            }
            const sliceState = state[slice.name]
            if (!sliceState || typeof sliceState !== 'object') {
                continue
            }

            const summary = createSliceSyncSummary(
                slice,
                sliceState as Record<string, unknown>,
            )

            if (Object.keys(summary).length === 0) {
                continue
            }
            summaryBySlice[slice.name] = summary
        }

        return summaryBySlice
    }

    const maybeSendContinuousSyncDiff = () => {
        if (!sessionContext.sessionId) {
            return
        }

        const continuousDirection = getAuthoritativeDirection()
        if (!isAuthorityForDirection({
            localInstanceMode: input.context.topology.getRecoveryState().instanceMode,
            direction: continuousDirection,
        })) {
            return
        }

        const syncState = input.context.getState() as Record<string, unknown>
        const syncRuntimeState = syncState[TOPOLOGY_CLIENT_SYNC_STATE_KEY] as {
            continuousSyncActive?: boolean
        } | undefined

        if (!syncRuntimeState?.continuousSyncActive) {
            return
        }

        const activeSession = input.context.topology.getSyncSession(
            sessionContext.sessionId,
            continuousDirection,
        )
        if (!activeSession || activeSession.status !== 'continuous') {
            return
        }
        if (!activeSession.peerNodeId) {
            return
        }

        const session = input.context.topology.collectContinuousSyncDiff({
            sessionId: sessionContext.sessionId,
            direction: continuousDirection,
            slices: input.context.getSyncSlices(),
            state: syncState,
        })

        const diffBySlice = Object.fromEntries(
            (session.lastDiff ?? []).map(entry => [entry.sliceName, entry.diff]),
        )
        const signature = JSON.stringify(diffBySlice)
        if (signature === '{}' || signature === lastContinuousDiffSignature) {
            return
        }

        send({
            type: 'state-sync-diff',
            envelope: {
                envelopeId: createEnvelopeId(),
                sessionId: sessionContext.sessionId as any,
                sourceNodeId: input.context.localNodeId as any,
                targetNodeId: activeSession.peerNodeId as any,
                direction: continuousDirection,
                diffBySlice,
                sentAt: nowTimestampMs(),
            },
        })

        pendingCommitSummaryByDirection.set(
            continuousDirection,
            buildCurrentSummaryByDirection(continuousDirection),
        )
        lastContinuousDiffSignature = signature
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

            const projection = input.context.getRequestProjection(snapshot.requestId)
            if (!projection) {
                continue
            }

            send({
                type: 'projection-mirror',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: inputArtifacts.sessionId as any,
                    ownerNodeId: snapshot.ownerNodeId,
                    projection,
                    mirroredAt: nowTimestampMs(),
                },
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
            direction: syncDirection,
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
    ): Promise<RequestProjection> => {
        const timeoutMs = getRemoteCommandResponseTimeoutMs()
        const pollIntervalMs = getRemoteCommandResponsePollIntervalMs()
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
                throw createAppError(topologyClientErrorDefinitions.remoteCommandResponseTimeout, {
                    args: {
                        commandName: command?.commandName ?? commandId,
                        timeoutMs,
                    },
                })
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
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
        lastContinuousDiffSignature = ''
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
        pendingCommitSummaryByDirection.set(
            message.envelope.direction,
            buildCurrentSummaryByDirection(message.envelope.direction),
        )
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
            direction: message.envelope.direction,
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
        const session = input.context.topology.getSyncSession(
            message.envelope.sessionId,
            message.envelope.direction,
        )
        const currentSummary: Record<string, SyncStateSummary> = pendingCommitSummaryByDirection.get(
            message.envelope.direction,
        ) ?? Object.fromEntries(
            (session?.localSummary ?? []).map(entry => [entry.sliceName, entry.summary]),
        )
        input.context.topology.handleSyncCommitAckEnvelope({
            envelope: message.envelope,
            currentSummary,
        })
        pendingCommitSummaryByDirection.delete(message.envelope.direction)
        lastContinuousDiffSignature = ''
        dispatchSyncPatch({
            lastCommitAckAt: message.envelope.committedAt,
            continuousSyncActive: true,
            resumeStatus: 'completed',
        })
        maybeSendContinuousSyncDiff()
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
                resetSessionState(nowTimestampMs(), 'pending')
                const reason = message.ack.rejectionMessage ?? message.ack.rejectionCode ?? 'hello rejected'
                dispatchConnectionPatch({
                    connectionError: reason,
                })
                scheduleReconnect(reason)
                return
            }

            reconnectAttempt = 0
            clearReconnectTimer()
            input.context.dispatchAction(topologyClientStateActions.patchTopologyClientPeer(resolvePeerFromAck(message.ack)))
            dispatchConnectionPatch({
                serverConnectionStatus: 'CONNECTED',
                connectedAt: nowTimestampMs(),
                connectionError: undefined,
                reconnectAttempt: 0,
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

        if (message.type === 'projection-mirror') {
            input.context.applyProjectionMirror(message.envelope)
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
            const occurredAt = nowTimestampMs()
            resetSessionState(occurredAt, 'pending')
            dispatchConnectionPatch({
                connectionError: 'hello unavailable',
            })
            scheduleReconnect('hello unavailable')
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
        stateUnsubscribe = input.context.subscribeState(() => {
            maybeSendContinuousSyncDiff()
        })
        binding.socketRuntime.on(binding.profileName, 'disconnected', event => {
            if (!isDisconnectedEvent(event)) {
                return
            }
            resetSessionState(event.occurredAt, 'pending')
            scheduleReconnect(event.reason ?? 'socket disconnected')
        })
        binding.socketRuntime.on(binding.profileName, 'error', event => {
            if (!isErrorEvent(event)) {
                return
            }
            const errorMessage = event.error instanceof Error ? event.error.message : String(event.error)
            dispatchConnectionPatch({
                connectionError: errorMessage,
            })
        })
    }

    const startConnection = async (
        inputValue: {
            isReconnect?: boolean
            commandName?: string
        } = {},
    ) => {
        if (!binding) {
            throw createSocketBindingUnavailableError(inputValue.commandName ?? 'startConnection')
        }
        if (disposed) {
            return
        }

        manualStop = false
        clearReconnectTimer()
        attachListeners()
        const token = ++connectionToken

        dispatchConnectionPatch({
            serverConnectionStatus: 'CONNECTING',
            reconnectAttempt: inputValue.isReconnect ? reconnectAttempt : 0,
            connectionError: undefined,
        })

        try {
            await binding.socketRuntime.connect(binding.profileName)
            if (disposed || token !== connectionToken || manualStop) {
                binding.socketRuntime.disconnect(binding.profileName, 'stale-connect')
                return
            }
            onConnected()
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            resetSessionState(nowTimestampMs(), 'pending')
            dispatchConnectionPatch({
                connectionError: errorMessage,
            })
            scheduleReconnect(errorMessage)
        }
    }

    return {
        async startConnection() {
            reconnectAttempt = 0
            await startConnection({commandName: 'startTopologyConnection'})
        },
        stopConnection(reason) {
            manualStop = true
            reconnectAttempt = 0
            connectionToken += 1
            clearReconnectTimer()
            resetSessionState(nowTimestampMs(), 'idle')
            binding?.socketRuntime.disconnect(binding.profileName, reason)
        },
        async restartConnection(reason) {
            manualStop = false
            reconnectAttempt = 0
            connectionToken += 1
            clearReconnectTimer()
            resetSessionState(nowTimestampMs(), 'idle')
            binding?.socketRuntime.disconnect(binding.profileName, reason)
            await startConnection({commandName: 'restartTopologyConnection'})
        },
        beginResume,
        async dispatchRemoteCommand(dispatchInput) {
            if (!sessionContext.sessionId) {
                throw createAppError(topologyClientErrorDefinitions.remoteNotConnected, {})
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
        },
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
        sendProjectionMirror(envelope) {
            send({
                type: 'projection-mirror',
                envelope,
            })
        },
        getSessionContext() {
            return {...sessionContext}
        },
    }
}
