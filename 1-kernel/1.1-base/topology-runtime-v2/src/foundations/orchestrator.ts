import {
    createAppError,
    createEnvelopeId,
    nowTimestampMs,
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
    type NodeRuntimeInfo,
    type ProjectionMirrorEnvelope,
    type RequestId,
} from '@impos2/kernel-base-contracts'
import type {CommandQueryResult, RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createCommand, type CommandAggregateResult} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createSocketLifecycleController,
    type SocketEvent,
} from '@impos2/kernel-base-transport-runtime'
import {topologyRuntimeV2StateActions} from '../features/slices'
import {topologyRuntimeV2ErrorDefinitions, topologyRuntimeV2ParameterDefinitions} from '../supports'
import type {
    DispatchPeerCommandInput,
    TopologyPeerGatewayV2,
    TopologyPeerOrchestratorV2,
    TopologyRuntimeV2IncomingMessage,
    TopologyRuntimeV2OutgoingMessage,
} from '../types'
import {
    TOPOLOGY_V2_CONNECTION_STATE_KEY,
} from './stateKeys'
import {createPeerStateFromRuntimeInfo} from './context'
import {
    createConnectionPrecheckReasons,
    createPeerRuntimeInfoFromNodeId,
    createResolvedBinding,
    resolveAuthoritativeDirection,
    resolveSyncDirection,
    selectTopologyRecoveryState,
    selectTopologySyncState,
    shouldAutoConnectOnBoot,
} from './orchestratorState'
import {
    buildRequestLifecycleSnapshotEnvelope,
    buildStateSyncCommitAckEnvelope,
    buildStateSyncSummaryEnvelope,
} from './orchestratorMessages'
import {createTopologyIncomingHandlers} from './orchestratorIncoming'
import {createTopologyV2SyncSessionManager} from './syncSession'
import {createTopologyV2SyncSummary} from './syncPlan'

/**
 * 设计意图：
 * orchestrator 是 topology-runtime-v2 的控制面协调器，负责把 peer 通道转换成 command、request mirror 和 state sync。
 * 它不承载业务模块逻辑；重点是让主副机之间的执行屏障、恢复和同步时序保持一致且可观测。
 */
const isMessageEvent = (
    event: SocketEvent<TopologyRuntimeV2IncomingMessage>,
): event is Extract<SocketEvent<TopologyRuntimeV2IncomingMessage>, {type: 'message'}> => event.type === 'message'

const isDisconnectedEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'disconnected'}> => event.type === 'disconnected'

const isErrorEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'error'}> => event.type === 'error'

const isFinalCommandAggregateResult = (
    command: CommandQueryResult,
): command is CommandAggregateResult => command.status !== 'RUNNING'

export const createTopologyPeerOrchestratorV2 = (input: {
    context: RuntimeModuleContextV2
    assembly: import('../types').TopologyRuntimeV2Assembly
    reconnectAttemptsOverride?: number
}): TopologyPeerOrchestratorV2 & {gateway: TopologyPeerGatewayV2} => {
    const binding = createResolvedBinding(
        input.assembly.resolveSocketBinding(input.context),
        input.context,
        input.reconnectAttemptsOverride,
    )
    const sessionState: {
        sessionId?: string
        peerRuntime?: NodeRuntimeInfo
    } = {}
    const syncSessions = createTopologyV2SyncSessionManager()
    let listenersAttached = false
    let stateUnsubscribe: (() => void) | undefined
    let lastContinuousDiffSignature = ''
    const pendingCommitSummaryByDirection = new Map<'master-to-slave' | 'slave-to-master', Record<string, any>>()

    if (binding?.profile) {
        binding.socketRuntime.registerProfile(binding.profile)
    }

    const dispatchConnectionPatch = (
        patch: Parameters<typeof topologyRuntimeV2StateActions.patchConnectionState>[0],
    ) => {
        input.context.dispatchAction(topologyRuntimeV2StateActions.patchConnectionState(patch))
    }

    const dispatchSyncPatch = (
        patch: Parameters<typeof topologyRuntimeV2StateActions.patchSyncState>[0],
    ) => {
        input.context.dispatchAction(topologyRuntimeV2StateActions.patchSyncState(patch))
    }

    const getContinuousDirection = (): 'master-to-slave' | 'slave-to-master' => {
        const recoveryState = selectTopologyRecoveryState(input.context.getState())
        return resolveSyncDirection({
            localInstanceMode: recoveryState?.instanceMode,
            peerRole: sessionState.peerRuntime?.role,
        })
    }

    const getAuthoritativeDirection = (): 'master-to-slave' | 'slave-to-master' => {
        const recoveryState = selectTopologyRecoveryState(input.context.getState())
        return resolveAuthoritativeDirection(recoveryState?.instanceMode)
    }

    const buildCurrentSummaryByDirection = (
        direction: 'master-to-slave' | 'slave-to-master',
    ): Record<string, any> => {
        const state = input.context.getState() as Record<string, unknown>
        return Object.fromEntries(
            createTopologyV2SyncSummary({
                direction,
                slices: input.context.getSyncSlices(),
                state,
            }).map(entry => [entry.sliceName, entry.summary]),
        )
    }

    const maybeSendContinuousSyncDiff = () => {
        if (!sessionState.sessionId || !sessionState.peerRuntime) {
            return
        }

        const direction = getAuthoritativeDirection()
        const syncState = selectTopologySyncState(input.context.getState())
        if (!syncState?.continuousSyncActive) {
            return
        }

        const activeSession = syncSessions.get(sessionState.sessionId, direction)
        if (!activeSession || activeSession.status !== 'continuous') {
            return
        }

        const session = syncSessions.collectContinuousDiff({
            sessionId: sessionState.sessionId as any,
            direction,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
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
                sessionId: sessionState.sessionId as any,
                sourceNodeId: input.context.localNodeId as any,
                targetNodeId: sessionState.peerRuntime.nodeId as any,
                direction,
                diffBySlice,
                sentAt: nowTimestampMs() as any,
            },
        })

        pendingCommitSummaryByDirection.set(
            direction,
            buildCurrentSummaryByDirection(direction),
        )
        lastContinuousDiffSignature = signature
    }

    const getReconnectAttempts = () => contextResolve(topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts)
    const getReconnectDelayMs = () => contextResolve(topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs)
    const getResponseTimeoutMs = () => contextResolve(topologyRuntimeV2ParameterDefinitions.remoteCommandResponseTimeoutMs)
    const getResponsePollIntervalMs = () => contextResolve(topologyRuntimeV2ParameterDefinitions.remoteCommandResponsePollIntervalMs)

    const contextResolve = <TValue>(definition: typeof topologyRuntimeV2ParameterDefinitions[keyof typeof topologyRuntimeV2ParameterDefinitions] & {defaultValue: TValue}) =>
        input.context.resolveParameter({
            key: definition.key,
            definition,
        }).value as TValue

    const createSocketBindingUnavailableError = (commandName: string) => {
        return createAppError(topologyRuntimeV2ErrorDefinitions.socketBindingUnavailable, {
            args: {commandName},
        })
    }

    const rememberPeerRuntime = (runtime: NodeRuntimeInfo | undefined) => {
        if (!runtime) {
            return
        }
        sessionState.peerRuntime = runtime
        input.context.dispatchAction(topologyRuntimeV2StateActions.patchPeerState(
            createPeerStateFromRuntimeInfo(runtime),
        ))
    }

    const rememberPeerNodeId = (peerNodeId: NodeRuntimeInfo['nodeId'] | string | undefined) => {
        if (!peerNodeId || peerNodeId === input.context.localNodeId) {
            return
        }
        if (sessionState.peerRuntime?.nodeId === peerNodeId) {
            return
        }
        rememberPeerRuntime(
            createPeerRuntimeInfoFromNodeId(peerNodeId as NodeRuntimeInfo['nodeId'], input.assembly, input.context),
        )
    }

    const send = (message: TopologyRuntimeV2OutgoingMessage) => {
        if (!binding) {
            throw createSocketBindingUnavailableError(message.type)
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

        const trackedRequestIds = new Set<string>([
            ...inputArtifacts.requestIds ?? [],
            ...(input.assembly.getResumeSnapshotRequestIds?.(input.context) ?? []),
        ])

        trackedRequestIds.forEach(requestId => {
            const request = input.context.queryRequest(requestId)
            if (!request) {
                return
            }
            send({
                type: 'request-lifecycle-snapshot',
                envelope: buildRequestLifecycleSnapshotEnvelope({
                    request,
                    sessionId: inputArtifacts.sessionId,
                    ownerNodeId: input.context.localNodeId as any,
                    targetNodeId: inputArtifacts.targetNodeId as any,
                }),
            })
        })

        const syncDirection = getContinuousDirection()
        syncSessions.begin({
            sessionId: inputArtifacts.sessionId as any,
            peerNodeId: inputArtifacts.targetNodeId as any,
            direction: syncDirection,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
            startedAt: nowTimestampMs() as any,
        })

        const summaryEnvelope = buildStateSyncSummaryEnvelope({
            sessionId: inputArtifacts.sessionId,
            sourceNodeId: input.context.localNodeId as any,
            targetNodeId: inputArtifacts.targetNodeId as any,
            direction: syncDirection,
            slices: input.context.getSyncSlices(),
            state: input.context.getState() as Record<string, unknown>,
        })
        pendingCommitSummaryByDirection.set(syncDirection, summaryEnvelope.summaryBySlice)
        send({
            type: 'state-sync-summary',
            envelope: summaryEnvelope,
        })
        dispatchSyncPatch({
            lastSummarySentAt: nowTimestampMs(),
        })
    }

    const beginResume = (requestIds?: readonly string[]) => {
        if (!sessionState.sessionId) {
            return
        }

        const startedAt = nowTimestampMs()
        dispatchSyncPatch({
            resumeStatus: 'active',
            activeSessionId: sessionState.sessionId,
        })

        send({
            type: 'resume-begin',
            sessionId: sessionState.sessionId,
            nodeId: input.context.localNodeId,
            timestamp: startedAt,
        })

        sendResumeArtifacts({
            sessionId: sessionState.sessionId,
            targetNodeId: sessionState.peerRuntime?.nodeId,
            requestIds,
        })

        send({
            type: 'resume-complete',
            sessionId: sessionState.sessionId,
            nodeId: input.context.localNodeId,
            timestamp: nowTimestampMs(),
        })

        dispatchConnectionPatch({
            lastResumeAt: nowTimestampMs(),
        })
        dispatchSyncPatch({
            resumeStatus: 'completed',
        })
        lastContinuousDiffSignature = ''
    }

    const waitForRemoteStarted = async (
        requestId: string,
        commandId: string,
    ): Promise<CommandAggregateResult> => {
        const timeoutMs = getResponseTimeoutMs()
        const pollIntervalMs = getResponsePollIntervalMs()
        const startedAt = Date.now()

        while (true) {
            const request = input.context.queryRequest(requestId)
            const command = request?.commands.find(item => item.commandId === commandId)
            if (command && command.actorResults.length > 0) {
                if (command.actorResults.some(item => item.status === 'RUNNING')) {
                    return {
                        ...command,
                        status: 'COMPLETED',
                    } as CommandAggregateResult
                }
                if (isFinalCommandAggregateResult(command)) {
                    return command
                }
            }
            if (Date.now() - startedAt > timeoutMs) {
                throw createAppError(topologyRuntimeV2ErrorDefinitions.remoteCommandResponseTimeout, {
                    args: {
                        commandName: commandId,
                        timeoutMs,
                    },
                })
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        }
    }

    const waitForRemoteResult = async (
        requestId: string,
        commandId: string,
    ): Promise<CommandAggregateResult> => {
        const timeoutMs = getResponseTimeoutMs()
        const pollIntervalMs = getResponsePollIntervalMs()
        const startedAt = Date.now()

        while (true) {
            const request = input.context.queryRequest(requestId)
            const command = request?.commands.find(item => item.commandId === commandId)
            if (command && command.completedAt && isFinalCommandAggregateResult(command)) {
                return command
            }
            if (Date.now() - startedAt > timeoutMs) {
                throw createAppError(topologyRuntimeV2ErrorDefinitions.remoteCommandResponseTimeout, {
                    args: {
                        commandName: commandId,
                        timeoutMs,
                    },
                })
            }
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        }
    }

    const dispatchRemoteCommand = async <TPayload = unknown>(
        command: DispatchPeerCommandInput<TPayload>,
    ) => {
        if (!sessionState.sessionId || !sessionState.peerRuntime) {
            throw createAppError(topologyRuntimeV2ErrorDefinitions.sessionUnavailable, {
                args: {commandName: command.commandName},
            })
        }
        const envelope: CommandDispatchEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: sessionState.sessionId as any,
            requestId: command.requestId as any,
            commandId: createEnvelopeId() as any,
            parentCommandId: command.parentCommandId as any,
            ownerNodeId: input.context.localNodeId as any,
            sourceNodeId: input.context.localNodeId as any,
            targetNodeId: command.targetNodeId as any,
            commandName: command.commandName,
            payload: command.payload,
            context: {},
            sentAt: nowTimestampMs() as any,
        }
        input.context.registerMirroredCommand({
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            parentCommandId: envelope.parentCommandId,
            commandName: envelope.commandName,
            target: 'peer',
            routeContext: envelope.context,
        })
        send({
            type: 'command-dispatch',
            envelope,
        })
        await waitForRemoteStarted(command.requestId, envelope.commandId)
        return {
            requestId: command.requestId,
            commandId: envelope.commandId,
            sessionId: sessionState.sessionId,
            targetNodeId: command.targetNodeId as any,
            startedAt: envelope.sentAt,
        }
    }

    const handleRemoteDispatch = async (envelope: CommandDispatchEnvelope) => {
        send({
            type: 'command-event',
            envelope: {
                envelopeId: createEnvelopeId(),
                sessionId: envelope.sessionId,
                requestId: envelope.requestId,
                commandId: envelope.commandId,
                ownerNodeId: envelope.ownerNodeId,
                sourceNodeId: input.context.localNodeId as any,
                eventType: 'started',
                occurredAt: nowTimestampMs() as any,
            },
        })
        void input.context.dispatchCommand({
            definition: {
                moduleName: envelope.commandName.split('.').slice(0, -1).join('.'),
                commandName: envelope.commandName,
                visibility: 'public',
                timeoutMs: 60_000,
                allowNoActor: false,
                allowReentry: false,
                defaultTarget: 'local',
            },
            payload: envelope.payload,
        }, {
            requestId: envelope.requestId as any,
            commandId: envelope.commandId as any,
            parentCommandId: envelope.parentCommandId as any,
            target: 'local',
            routeContext: envelope.context,
        }).then(result => {
            const eventType: CommandEventEnvelope['eventType'] =
                result.status === 'FAILED' ? 'failed' : 'completed'
            send({
                type: 'command-event',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: envelope.sessionId,
                    requestId: envelope.requestId,
                    commandId: envelope.commandId,
                    ownerNodeId: envelope.ownerNodeId,
                    sourceNodeId: input.context.localNodeId as any,
                    eventType,
                    result: result.actorResults.find(item => item.result)?.result,
                    error: (() => {
                        const actorError = result.actorResults.find(item => item.error)?.error
                        if (!actorError) {
                            return undefined
                        }
                        return {
                            key: actorError.key,
                            code: actorError.code,
                            message: actorError.message,
                            details: actorError.details,
                        }
                    })(),
                    occurredAt: nowTimestampMs() as any,
                },
            })
        }).catch(error => {
            send({
                type: 'command-event',
                envelope: {
                    envelopeId: createEnvelopeId(),
                    sessionId: envelope.sessionId,
                    requestId: envelope.requestId,
                    commandId: envelope.commandId,
                    ownerNodeId: envelope.ownerNodeId,
                    sourceNodeId: input.context.localNodeId as any,
                    eventType: 'failed',
                    error: {
                        key: topologyRuntimeV2ErrorDefinitions.connectionFailed.key,
                        code: topologyRuntimeV2ErrorDefinitions.connectionFailed.code ?? topologyRuntimeV2ErrorDefinitions.connectionFailed.key,
                        message: error instanceof Error ? error.message : String(error),
                    },
                    occurredAt: nowTimestampMs() as any,
                },
            })
        })
    }

    const incomingHandlers = createTopologyIncomingHandlers({
        setSessionId: sessionId => {
            sessionState.sessionId = sessionId
        },
        onHelloAccepted: () => undefined,
        rememberPeerRuntime,
        rememberPeerNodeId,
        sendResumeArtifacts,
        send,
        dispatchConnectionPatch,
        dispatchSyncPatch,
        scheduleReconnect: reason => {
            lifecycle.scheduleReconnect(reason)
        },
        clearReconnectTimer: () => {
            lifecycle.clearReconnectTimer()
        },
        beginResume: () => beginResume(),
        setReconnectAttempt: next => {
            if (next === 0) {
                lifecycle.resetReconnectAttempt()
            }
        },
        getCurrentSummaryByDirection: buildCurrentSummaryByDirection,
        pendingCommitSummaryByDirection,
        syncSessions,
        context: {
            localNodeId: input.context.localNodeId as any,
            getSyncSlices: () => input.context.getSyncSlices(),
            getState: () => input.context.getState() as Record<string, unknown>,
            applyRemoteCommandEvent: envelope => input.context.applyRemoteCommandEvent(envelope),
            applyRequestLifecycleSnapshot: snapshot => input.context.applyRequestLifecycleSnapshot(snapshot),
            applyStateSyncDiff: envelope => input.context.applyStateSyncDiff(envelope),
            dispatchAction: action => input.context.dispatchAction(action),
        },
        handleRemoteDispatch,
        resetContinuousDiffSignature: () => {
            lastContinuousDiffSignature = ''
        },
        maybeSendContinuousSyncDiff,
    })

    const onMessage = (event: SocketEvent<TopologyRuntimeV2IncomingMessage>) => {
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
            incomingHandlers.handleHelloAck(message)
            return
        }
        if (message.type === 'resume-begin') {
            incomingHandlers.handleResumeBegin(message)
            return
        }
        if (message.type === 'command-dispatch') {
            rememberPeerNodeId(message.envelope.sourceNodeId)
            void handleRemoteDispatch(message.envelope)
            return
        }
        if (message.type === 'command-event') {
            rememberPeerNodeId(message.envelope.sourceNodeId)
            input.context.applyRemoteCommandEvent(message.envelope)
            return
        }
        if (message.type === 'request-lifecycle-snapshot') {
            incomingHandlers.handleRequestLifecycleSnapshot(message)
            return
        }
        if (message.type === 'projection-mirror') {
            rememberPeerNodeId(message.envelope.ownerNodeId)
            input.context.dispatchAction(topologyRuntimeV2StateActions.applyProjectionMirror(message.envelope))
            return
        }
        if (message.type === 'state-sync-summary') {
            incomingHandlers.handleStateSyncSummary(message)
            return
        }
        if (message.type === 'state-sync-diff') {
            incomingHandlers.handleStateSyncDiff(message)
            return
        }
        if (message.type === 'state-sync-commit-ack') {
            incomingHandlers.handleStateSyncCommitAck(message)
        }
    }

    const sendHelloAfterConnect = () => {
        const hello = input.assembly.createHello(input.context)
        if (!hello) {
            dispatchConnectionPatch({
                connectionError: 'hello unavailable',
                serverConnectionStatus: 'DISCONNECTED',
            })
            lifecycle.scheduleReconnect('hello unavailable')
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
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
                connectionError: event.reason,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                continuousSyncActive: false,
            })
        })
    }

    const performConnection = async (options?: {isReconnect?: boolean; manualTrigger?: boolean}) => {
        if (!binding) {
            throw createSocketBindingUnavailableError('start-topology-connection')
        }
        attachListeners()
        await binding.socketRuntime.connect(binding.profileName)
    }

    let nextManualTrigger: boolean | undefined

    const lifecycle = createSocketLifecycleController({
        connect: options => performConnection({
            ...options,
            manualTrigger: nextManualTrigger,
        }),
        disconnect(reason) {
            binding?.socketRuntime.disconnect(binding.profileName, reason)
        },
        attachListeners(handlers) {
            attachListeners()
            if (!binding) {
                return
            }
            binding.socketRuntime.on(binding.profileName, 'connected', () => {
                handlers.connected()
            })
            binding.socketRuntime.on(binding.profileName, 'disconnected', event => {
                if (!isDisconnectedEvent(event)) {
                    return
                }
                handlers.disconnected(event.reason)
            })
            binding.socketRuntime.on(binding.profileName, 'error', event => {
                if (!isErrorEvent(event)) {
                    return
                }
                handlers.error(event.error)
            })
        },
        resolveReconnectPolicy() {
            return {
                attempts: getReconnectAttempts(),
                delayMs: getReconnectDelayMs(),
            }
        },
        shouldReconnect() {
            return Boolean(binding) && shouldAutoConnectOnBoot(input.context)
        },
        onConnectStarting() {
            dispatchConnectionPatch({
                serverConnectionStatus: 'CONNECTING',
                connectionError: undefined,
            })
        },
        onConnectResolved() {
            sendHelloAfterConnect()
        },
        onConnectFailed({isReconnect, error}) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
                connectionError: errorMessage,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                continuousSyncActive: false,
            })
            if (!isReconnect) {
                return
            }
        },
        onDisconnected(reason) {
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
                connectionError: reason,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                continuousSyncActive: false,
            })
        },
        onReconnectScheduled({reason, attempt}) {
            dispatchConnectionPatch({
                serverConnectionStatus: 'CONNECTING',
                reconnectAttempt: attempt,
                connectionError: reason,
            })
            dispatchSyncPatch({
                resumeStatus: 'pending',
                continuousSyncActive: false,
            })
        },
    })

    const startConnection = async (options?: {isReconnect?: boolean; manualTrigger?: boolean}) => {
        if (!options?.isReconnect) {
            const reasons = createConnectionPrecheckReasons(input.context, {
                mode: options?.manualTrigger === false ? 'auto' : 'manual',
            })
            if (reasons.length > 0) {
                throw createAppError(topologyRuntimeV2ErrorDefinitions.connectionPrecheckFailed, {
                    args: {
                        reasons: reasons.join(', '),
                    },
                    details: {
                        reasons,
                    },
                })
            }
        }
        nextManualTrigger = options?.manualTrigger
        try {
            await lifecycle.start({isReconnect: options?.isReconnect})
        } catch (error) {
            if ((error as {key?: string})?.key === topologyRuntimeV2ErrorDefinitions.socketBindingUnavailable.key) {
                throw error
            }
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (!options?.isReconnect) {
                throw createAppError(topologyRuntimeV2ErrorDefinitions.connectionFailed, {
                    args: {
                        message: errorMessage,
                    },
                    cause: error,
                })
            }
        } finally {
            nextManualTrigger = undefined
        }
    }

    const stopConnection = (reason?: string) => {
        lifecycle.stop(reason)
        stateUnsubscribe?.()
        stateUnsubscribe = undefined
        listenersAttached = false
        dispatchConnectionPatch({
            serverConnectionStatus: 'DISCONNECTED',
            disconnectedAt: nowTimestampMs(),
            reconnectAttempt: 0,
        })
        dispatchSyncPatch({
            resumeStatus: 'idle',
            continuousSyncActive: false,
        })
    }

    const restartConnection = async (reason?: string) => {
        stopConnection(reason)
        await startConnection()
    }

    const gateway: TopologyPeerGatewayV2 = {
        async dispatchCommand(command, options) {
            const targetNodeId = sessionState.peerRuntime?.nodeId
            if (!targetNodeId) {
                throw createAppError(topologyRuntimeV2ErrorDefinitions.remoteNotConnected)
            }
            const remote = await dispatchRemoteCommand({
                requestId: (options.requestId ?? createEnvelopeId()) as RequestId,
                parentCommandId: options.parentCommandId ?? createEnvelopeId(),
                targetNodeId,
                commandName: command.definition.commandName,
                payload: command.payload,
            })
            const aggregate = await waitForRemoteResult(remote.requestId, remote.commandId)
            return aggregate
        },
    }

    return {
        gateway,
        startConnection,
        stopConnection,
        restartConnection,
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
        sendProjectionMirror(envelope) {
            send({
                type: 'projection-mirror',
                envelope,
            })
        },
        getSessionContext() {
            return {
                ...sessionState,
            }
        },
    }
}
