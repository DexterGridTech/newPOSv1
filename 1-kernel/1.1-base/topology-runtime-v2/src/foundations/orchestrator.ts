import {
    createAppError,
    createEnvelopeId,
    nowTimestampMs,
    type CommandDispatchEnvelope,
    type CommandEventEnvelope,
    type NodeId,
    type NodeRuntimeInfo,
    type ProjectionMirrorEnvelope,
    type RequestId,
    type RequestLifecycleSnapshotEnvelope,
    type StateSyncCommitAckEnvelope,
    type StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createCommand, type CommandAggregateResult} from '@impos2/kernel-base-runtime-shell-v2'
import {defineSocketProfile, JsonSocketCodec, type SocketEvent} from '@impos2/kernel-base-transport-runtime'
import {topologyRuntimeV2StateActions} from '../features/slices'
import {topologyRuntimeV2ErrorDefinitions, topologyRuntimeV2ParameterDefinitions} from '../supports'
import type {
    DispatchPeerCommandInput,
    TopologyPeerGatewayV2,
    TopologyPeerOrchestratorV2,
    TopologyRuntimeV2Assembly,
    TopologyRuntimeV2IncomingMessage,
    TopologyRuntimeV2OutgoingMessage,
    TopologyRuntimeV2SocketBinding,
} from '../types'
import {
    TOPOLOGY_V2_CONNECTION_STATE_KEY,
    TOPOLOGY_V2_RECOVERY_STATE_KEY,
    TOPOLOGY_V2_SYNC_STATE_KEY,
} from './stateKeys'
import {createPeerStateFromRuntimeInfo} from './context'

const isMessageEvent = (
    event: SocketEvent<TopologyRuntimeV2IncomingMessage>,
): event is Extract<SocketEvent<TopologyRuntimeV2IncomingMessage>, {type: 'message'}> => event.type === 'message'

const isDisconnectedEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'disconnected'}> => event.type === 'disconnected'

const isErrorEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'error'}> => event.type === 'error'

const shouldAutoConnectOnBoot = (context: RuntimeModuleContextV2) => {
    const recoveryState = context.getState()?.[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof ReturnType<typeof context.getState>] as
        | {instanceMode?: string; masterInfo?: unknown; enableSlave?: boolean}
        | undefined
    return recoveryState?.instanceMode === 'SLAVE'
        ? Boolean(recoveryState.masterInfo)
        : recoveryState?.enableSlave === true
}

const createResolvedBinding = (
    binding: TopologyRuntimeV2SocketBinding | undefined,
    context: RuntimeModuleContextV2,
    reconnectAttemptsOverride?: number,
): TopologyRuntimeV2SocketBinding | undefined => {
    if (!binding?.profile) {
        return binding
    }

    const connectionTimeoutMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverConnectionTimeoutMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverConnectionTimeoutMs,
    }).value
    const heartbeatTimeoutMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverHeartbeatTimeoutMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverHeartbeatTimeoutMs,
    }).value
    const reconnectDelayMs = context.resolveParameter({
        key: topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs.key,
        definition: topologyRuntimeV2ParameterDefinitions.serverReconnectIntervalMs,
    }).value
    const reconnectAttempts = reconnectAttemptsOverride
        ?? context.resolveParameter({
            key: topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts.key,
            definition: topologyRuntimeV2ParameterDefinitions.serverReconnectAttempts,
        }).value

    return {
        ...binding,
        profile: defineSocketProfile({
            name: binding.profile.name,
            serverName: binding.profile.serverName,
            pathTemplate: binding.profile.pathTemplate,
            handshake: binding.profile.handshake,
            messages: binding.profile.messages,
            codec: binding.profile.codec ?? new JsonSocketCodec(),
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

export const createTopologyPeerOrchestratorV2 = (input: {
    context: RuntimeModuleContextV2
    assembly: TopologyRuntimeV2Assembly
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
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manualStop = false

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

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return
        }
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
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

    const getLocalRuntimeInfo = () => input.assembly.getRuntimeInfo?.(input.context)
        ?? input.assembly.createHello(input.context)?.runtime

    const createPeerRuntimeInfoFromNodeId = (peerNodeId: NodeId): NodeRuntimeInfo => {
        const localRuntime = getLocalRuntimeInfo()
        const localRole = localRuntime?.role
        const peerRole: NodeRuntimeInfo['role'] = localRole === 'slave' ? 'master' : 'slave'
        return {
            nodeId: peerNodeId,
            deviceId: peerNodeId,
            role: peerRole,
            platform: localRuntime?.platform ?? 'unknown',
            product: localRuntime?.product ?? 'unknown',
            assemblyAppId: localRuntime?.assemblyAppId ?? 'unknown',
            assemblyVersion: localRuntime?.assemblyVersion ?? 'unknown',
            buildNumber: localRuntime?.buildNumber ?? 0,
            bundleVersion: localRuntime?.bundleVersion ?? 'unknown',
            runtimeVersion: localRuntime?.runtimeVersion ?? 'unknown',
            protocolVersion: localRuntime?.protocolVersion ?? 'unknown',
            capabilities: localRuntime?.capabilities ?? [],
        }
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

    const rememberPeerNodeId = (peerNodeId: NodeId | string | undefined) => {
        if (!peerNodeId || peerNodeId === input.context.localNodeId) {
            return
        }
        if (sessionState.peerRuntime?.nodeId === peerNodeId) {
            return
        }
        rememberPeerRuntime(createPeerRuntimeInfoFromNodeId(peerNodeId as NodeId))
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
            const snapshotEnvelope: RequestLifecycleSnapshotEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId: inputArtifacts.sessionId as any,
                requestId: request.requestId as any,
                ownerNodeId: input.context.localNodeId as any,
                sourceNodeId: input.context.localNodeId as any,
                targetNodeId: inputArtifacts.targetNodeId as any,
                snapshot: {
                    requestId: request.requestId as any,
                    ownerNodeId: input.context.localNodeId as any,
                    rootCommandId: request.rootCommandId as any,
                    sessionId: inputArtifacts.sessionId as any,
                    status: request.status === 'COMPLETED' ? 'complete' : request.status === 'FAILED' ? 'error' : 'started',
                    startedAt: request.startedAt as any,
                    updatedAt: request.updatedAt as any,
                    commands: request.commands.map(command => ({
                        commandId: command.commandId as any,
                        parentCommandId: command.parentCommandId as any,
                        ownerNodeId: input.context.localNodeId as any,
                        sourceNodeId: input.context.localNodeId as any,
                        targetNodeId: inputArtifacts.targetNodeId as any,
                        commandName: command.commandName,
                        status: command.status === 'COMPLETED' ? 'complete' : command.status === 'FAILED' ? 'error' : 'started',
                        result: command.actorResults.find(result => result.result)?.result,
                        error: command.actorResults.find(result => result.error)?.error,
                        startedAt: command.startedAt as any,
                        updatedAt: command.completedAt as any,
                    })),
                    commandResults: [],
                },
                sentAt: nowTimestampMs() as any,
            }
            send({
                type: 'request-lifecycle-snapshot',
                envelope: snapshotEnvelope,
            })
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
            if (command && command.completedAt) {
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
        send({
            type: 'command-dispatch',
            envelope,
        })
        await waitForRemoteResult(command.requestId, envelope.commandId)
        return {
            requestId: command.requestId,
            commandId: envelope.commandId,
            sessionId: sessionState.sessionId,
            targetNodeId: command.targetNodeId as any,
            startedAt: envelope.sentAt,
        }
    }

    const scheduleReconnect = (reason?: string) => {
        if (!binding || manualStop || reconnectTimer || !shouldAutoConnectOnBoot(input.context)) {
            return
        }
        const maxAttempts = getReconnectAttempts()
        if (maxAttempts >= 0 && reconnectAttempt >= maxAttempts) {
            return
        }
        reconnectAttempt += 1
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
        }, getReconnectDelayMs())
    }

    const handleRemoteDispatch = async (envelope: CommandDispatchEnvelope) => {
        input.context.registerMirroredCommand({
            requestId: envelope.requestId,
            commandId: envelope.commandId,
            parentCommandId: envelope.parentCommandId,
            commandName: envelope.commandName,
            target: 'peer',
            routeContext: envelope.context,
        })
        await input.context.dispatchCommand({
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
        })
    }

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
            sessionState.sessionId = message.ack.sessionId
            if (!message.ack.accepted || !message.ack.sessionId) {
                dispatchConnectionPatch({
                    connectionError: message.ack.rejectionMessage ?? message.ack.rejectionCode,
                    serverConnectionStatus: 'DISCONNECTED',
                })
                scheduleReconnect(message.ack.rejectionMessage ?? message.ack.rejectionCode)
                return
            }
            reconnectAttempt = 0
            clearReconnectTimer()
            rememberPeerRuntime(message.ack.peerRuntime)
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
            sessionState.sessionId = message.sessionId
            rememberPeerNodeId(message.nodeId)
            sendResumeArtifacts({
                sessionId: message.sessionId,
                targetNodeId: message.nodeId,
            })
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
            rememberPeerNodeId(message.envelope.sourceNodeId)
            input.context.applyRequestLifecycleSnapshot(message.envelope.snapshot)
            return
        }
        if (message.type === 'projection-mirror') {
            rememberPeerNodeId(message.envelope.ownerNodeId)
            return
        }
        if (message.type === 'state-sync-summary') {
            rememberPeerNodeId(message.envelope.sourceNodeId)
            const ack: StateSyncCommitAckEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId: message.envelope.sessionId,
                sourceNodeId: message.envelope.targetNodeId,
                targetNodeId: message.envelope.sourceNodeId,
                direction: message.envelope.direction,
                committedAt: nowTimestampMs() as any,
            }
            send({
                type: 'state-sync-commit-ack',
                envelope: ack,
            })
            return
        }
        if (message.type === 'state-sync-diff') {
            rememberPeerNodeId(message.envelope.sourceNodeId)
            input.context.applyStateSyncDiff(message.envelope)
            dispatchSyncPatch({
                lastDiffAppliedAt: nowTimestampMs(),
                continuousSyncActive: true,
            })
            return
        }
        if (message.type === 'state-sync-commit-ack') {
            rememberPeerNodeId(message.envelope.sourceNodeId)
            dispatchSyncPatch({
                lastCommitAckAt: message.envelope.committedAt,
                continuousSyncActive: true,
                resumeStatus: 'completed',
            })
        }
    }

    const onConnected = () => {
        const hello = input.assembly.createHello(input.context)
        if (!hello) {
            dispatchConnectionPatch({
                connectionError: 'hello unavailable',
                serverConnectionStatus: 'DISCONNECTED',
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
        if (!binding) {
            return
        }
        binding.socketRuntime.on(binding.profileName, 'message', onMessage)
        binding.socketRuntime.on(binding.profileName, 'disconnected', event => {
            if (!isDisconnectedEvent(event)) {
                return
            }
            dispatchConnectionPatch({
                serverConnectionStatus: 'DISCONNECTED',
                disconnectedAt: nowTimestampMs(),
                connectionError: event.reason,
            })
            scheduleReconnect(event.reason)
        })
        binding.socketRuntime.on(binding.profileName, 'error', event => {
            if (!isErrorEvent(event)) {
                return
            }
            scheduleReconnect(event.error instanceof Error ? event.error.message : String(event.error))
        })
    }

    const startConnection = async (options?: {isReconnect?: boolean}) => {
        if (!binding) {
            throw createSocketBindingUnavailableError('start-topology-connection')
        }
        clearReconnectTimer()
        manualStop = false
        dispatchConnectionPatch({
            serverConnectionStatus: options?.isReconnect ? 'CONNECTING' : 'CONNECTING',
            connectionError: undefined,
        })
        binding.socketRuntime.registerProfile(binding.profile ?? defineSocketProfile({
            name: binding.profileName,
            serverName: 'dual-topology-host',
            pathTemplate: '/mockMasterServer/ws',
            handshake: {headers: {} as any},
            messages: {incoming: {} as any, outgoing: {} as any},
            codec: new JsonSocketCodec(),
        }))
        attachListeners()
        await binding.socketRuntime.connect(binding.profileName)
        onConnected()
    }

    const stopConnection = (reason?: string) => {
        manualStop = true
        clearReconnectTimer()
        binding?.socketRuntime.disconnect(binding.profileName, reason)
        dispatchConnectionPatch({
            serverConnectionStatus: 'DISCONNECTED',
            disconnectedAt: nowTimestampMs(),
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
