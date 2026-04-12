import {
    createAppError,
    protocolVersion,
} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {
    createHttpRuntime,
    type HttpTransport,
    type SocketEvent,
} from '@impos2/kernel-base-transport-runtime'
import {
    selectTcpAccessToken,
    selectTcpTerminalId,
} from '@impos2/kernel-base-tcp-control-runtime'
import {moduleName} from '../moduleName'
import {packageVersion} from '../generated/packageVersion'
import {tdpSyncCommandNames} from '../features/commands'
import {tdpSyncStateActions, tdpSyncStateSlices} from '../features/slices'
import {selectTdpSyncState} from '../selectors'
import {
    tdpSyncErrorDefinitionList,
    tdpSyncErrorDefinitions,
    tdpSyncParameterDefinitions,
    tdpSyncParameterDefinitionList,
} from '../supports'
import {createTdpSyncHttpService} from './httpService'
import {reduceTdpServerMessage} from './messageReducer'
import {tdpSyncSocketProfile, TDP_SYNC_SOCKET_PROFILE_NAME} from './socketBinding'
import {
    createTopicChangePublisherFingerprint,
    publishTopicDataChanges,
} from './topicChangePublisher'
import type {
    CreateTdpSyncRuntimeModuleInput,
    TdpClientMessage,
    TdpServerMessage,
} from '../types'

type InstallContext = Parameters<NonNullable<KernelRuntimeModule['install']>>[0]

const isMessageEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<TdpServerMessage>, {type: 'message'}> => event.type === 'message'

const isDisconnectedEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'disconnected'}> => event.type === 'disconnected'

const isErrorEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'error'}> => event.type === 'error'

const isReconnectingEvent = (
    event: SocketEvent<unknown>,
): event is Extract<SocketEvent<unknown>, {type: 'reconnecting'}> => event.type === 'reconnecting'

const createFetchHttpTransport = (): HttpTransport => {
    return {
        async execute(request) {
            const response = await fetch(request.url, {
                method: request.endpoint.method,
                headers: {
                    'content-type': 'application/json',
                    ...(request.input.headers ?? {}),
                },
                body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
            })

            return {
                data: await response.json(),
                status: response.status,
                statusText: response.statusText,
                headers: (() => {
                    const headers: Record<string, string> = {}
                    response.headers.forEach((value, key) => {
                        headers[key] = value
                    })
                    return headers
                })(),
            }
        },
    }
}

const createDefaultHttpRuntime = (context: InstallContext) => {
    return createHttpRuntime({
        logger: context.platformPorts.logger.scope({
            moduleName,
            subsystem: 'transport.http',
            component: 'TdpSyncHttpRuntime',
        }),
        transport: createFetchHttpTransport(),
        servers: [
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {
                        addressName: 'local-default',
                        baseUrl: 'http://127.0.0.1:5810',
                    },
                ],
            },
        ],
    })
}

const dispatchReducedMessage = (
    context: InstallContext,
    message: TdpServerMessage,
) => {
    reduceTdpServerMessage(action => {
        context.dispatchAction(action as any)
    }, message)
}

const sendAck = (
    context: InstallContext,
    input: CreateTdpSyncRuntimeModuleInput,
    payload: {
        cursor: number
        topic?: string
        itemKey?: string
        instanceId?: string
    },
) => {
    if (!input.assembly) {
        return
    }
    const socketBinding = input.assembly.resolveSocketBinding?.(context)
    if (!socketBinding) {
        return
    }
    socketBinding.socketRuntime.send(socketBinding.profileName, {
        type: 'ACK',
        data: payload,
    })
}

const sendStateReport = (
    context: InstallContext,
    input: CreateTdpSyncRuntimeModuleInput,
    payload: {
        cursor: number
        connectionMetrics?: Record<string, unknown>
        localStoreMetrics?: Record<string, unknown>
    },
) => {
    if (!input.assembly) {
        return
    }
    const socketBinding = input.assembly.resolveSocketBinding?.(context)
    if (!socketBinding) {
        return
    }
    socketBinding.socketRuntime.send(socketBinding.profileName, {
        type: 'STATE_REPORT',
        data: {
            lastAppliedCursor: payload.cursor,
            connectionMetrics: payload.connectionMetrics,
            localStoreMetrics: payload.localStoreMetrics,
        },
    })
}

const applyServerMessage = (
    context: InstallContext,
    input: CreateTdpSyncRuntimeModuleInput,
    message: TdpServerMessage,
) => {
    dispatchReducedMessage(context, message)

    switch (message.type) {
        case 'FULL_SNAPSHOT':
            context.dispatchAction(tdpSyncStateActions.setChangesStatus('ready'))
            context.dispatchAction(tdpSyncStateActions.setLastDeliveredCursor(message.data.highWatermark))
            context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(message.data.highWatermark))
            context.dispatchAction(tdpSyncStateActions.setLastAppliedCursor(message.data.highWatermark))
            if (message.data.highWatermark > 0) {
                sendAck(context, input, {
                    cursor: message.data.highWatermark,
                })
                sendStateReport(context, input, {
                    cursor: message.data.highWatermark,
                })
            }
            return

        case 'CHANGESET':
            context.dispatchAction(tdpSyncStateActions.setChangesStatus('ready'))
            context.dispatchAction(tdpSyncStateActions.setLastDeliveredCursor(message.data.nextCursor))
            context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(message.data.nextCursor))
            context.dispatchAction(tdpSyncStateActions.setLastAppliedCursor(message.data.nextCursor))
            if (message.data.nextCursor > 0) {
                sendAck(context, input, {
                    cursor: message.data.nextCursor,
                })
                sendStateReport(context, input, {
                    cursor: message.data.nextCursor,
                })
            }
            return

        case 'PROJECTION_CHANGED':
            context.dispatchAction(tdpSyncStateActions.setLastAppliedCursor(message.data.cursor))
            context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(message.data.cursor))
            sendAck(context, input, {
                cursor: message.data.cursor,
                topic: message.data.change.topic,
                itemKey: message.data.change.itemKey,
            })
            sendStateReport(context, input, {
                cursor: message.data.cursor,
            })
            return

        case 'PROJECTION_BATCH':
            context.dispatchAction(tdpSyncStateActions.setLastAppliedCursor(message.data.nextCursor))
            if (message.data.nextCursor > 0) {
                context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(message.data.nextCursor))
                sendAck(context, input, {
                    cursor: message.data.nextCursor,
                })
                sendStateReport(context, input, {
                    cursor: message.data.nextCursor,
                })
            }
            return

        case 'COMMAND_DELIVERED': {
            const resolvedCursor = selectTdpSyncState(context.getState())?.lastCursor ?? 0
            if (resolvedCursor > 0) {
                context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(resolvedCursor))
            }
            sendAck(context, input, {
                cursor: resolvedCursor,
                topic: message.data.topic,
                itemKey: message.data.commandId,
                instanceId: typeof message.data.payload.instanceId === 'string'
                    ? message.data.payload.instanceId
                    : undefined,
            })
            return
        }

        case 'PONG':
        case 'EDGE_DEGRADED':
        case 'SESSION_REHOME_REQUIRED':
        case 'SESSION_READY':
        case 'ERROR':
            return
    }
}

const resolveSocketBinding = (
    context: InstallContext,
    input: CreateTdpSyncRuntimeModuleInput,
) => {
    const socketBinding = input.assembly?.resolveSocketBinding?.(context)
    if (!socketBinding?.profile) {
        return socketBinding
    }

    const reconnectDelayMs = context.resolveParameter<number>({
        key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
    }).value

    const reconnectAttempts = input.socket?.reconnectAttempts
        ?? context.resolveParameter<number>({
            key: tdpSyncParameterDefinitions.tdpReconnectAttempts.key,
        }).value

    return {
        ...socketBinding,
        profile: {
            ...socketBinding.profile,
            meta: {
                ...socketBinding.profile.meta,
                reconnectDelayMs,
                reconnectAttempts,
            },
        },
    }
}

export const createTdpSyncRuntimeModule = (
    input: CreateTdpSyncRuntimeModuleInput = {},
): KernelRuntimeModule => {
    return {
        moduleName,
        packageVersion,
        dependencies: [
            {
                moduleName: 'kernel.base.tcp-control-runtime',
            },
        ],
        stateSlices: tdpSyncStateSlices,
        commands: [
            {name: tdpSyncCommandNames.bootstrapTdpSync, visibility: 'internal'},
            {name: tdpSyncCommandNames.bootstrapTdpSyncSucceeded, visibility: 'internal'},
            {name: tdpSyncCommandNames.connectTdpSession, visibility: 'public'},
            {name: tdpSyncCommandNames.disconnectTdpSession, visibility: 'public'},
            {name: tdpSyncCommandNames.acknowledgeCursor, visibility: 'public'},
            {name: tdpSyncCommandNames.reportAppliedCursor, visibility: 'public'},
            {name: tdpSyncCommandNames.sendPing, visibility: 'public'},
            {name: tdpSyncCommandNames.tdpSocketConnected, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSocketReconnecting, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSocketDisconnected, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSocketErrored, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSocketHeartbeatTimedOut, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpMessageReceived, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSessionReady, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSnapshotLoaded, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpChangesLoaded, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpProjectionReceived, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpProjectionBatchReceived, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpCommandDelivered, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpPongReceived, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpEdgeDegraded, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpSessionRehomeRequired, visibility: 'internal'},
            {name: tdpSyncCommandNames.tdpProtocolFailed, visibility: 'internal'},
        ],
        errorDefinitions: tdpSyncErrorDefinitionList,
        parameterDefinitions: tdpSyncParameterDefinitionList,
        initializeCommands: [
            {
                commandName: tdpSyncCommandNames.bootstrapTdpSync,
                payload: {},
            },
        ],
        install(context) {
            createTdpSyncHttpService(
                input.assembly?.createHttpRuntime(context) ?? createDefaultHttpRuntime(context),
            )

            const socketBinding = resolveSocketBinding(context, input)
            let reconnectTimer: ReturnType<typeof setTimeout> | undefined
            let reconnectAttempt = 0
            let manualDisconnect = false
            const topicChangeFingerprint = createTopicChangePublisherFingerprint()
            let topicChangePublishRunning = false
            let topicChangePublishDirty = false

            const clearReconnectTimer = () => {
                if (!reconnectTimer) {
                    return
                }
                clearTimeout(reconnectTimer)
                reconnectTimer = undefined
            }

            const getReconnectAttempts = () => {
                return input.socket?.reconnectAttempts
                    ?? context.resolveParameter<number>({
                        key: tdpSyncParameterDefinitions.tdpReconnectAttempts.key,
                    }).value
            }

            const getReconnectDelayMs = () => {
                return context.resolveParameter<number>({
                    key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                }).value
            }

            const sendHandshake = () => {
                if (!socketBinding) {
                    throw createAppError(tdpSyncErrorDefinitions.assemblyRequired, {
                        args: {
                            commandName: tdpSyncCommandNames.connectTdpSession,
                        },
                    })
                }

                const state = context.getState()
                const terminalId = selectTcpTerminalId(state)
                const accessToken = selectTcpAccessToken(state)
                if (!terminalId || !accessToken) {
                    throw createAppError(tdpSyncErrorDefinitions.credentialMissing, {
                        context: {
                            commandName: tdpSyncCommandNames.connectTdpSession,
                            nodeId: context.localNodeId as any,
                        },
                    })
                }

                const lastCursor = selectTdpSyncState(state)?.lastCursor
                const handshakeMessage: TdpClientMessage = {
                    type: 'HANDSHAKE',
                    data: {
                        terminalId,
                        appVersion: packageVersion,
                        lastCursor,
                        protocolVersion,
                    },
                }

                socketBinding.socketRuntime.send(socketBinding.profileName, handshakeMessage)
                context.dispatchAction(tdpSyncStateActions.setStatus('HANDSHAKING'))
            }

            const startSocketConnection = async (options?: {isReconnect?: boolean}) => {
                if (!socketBinding) {
                    throw createAppError(tdpSyncErrorDefinitions.assemblyRequired, {
                        args: {
                            commandName: tdpSyncCommandNames.connectTdpSession,
                        },
                    })
                }

                const state = context.getState()
                const terminalId = selectTcpTerminalId(state)
                const accessToken = selectTcpAccessToken(state)
                if (!terminalId || !accessToken) {
                    throw createAppError(tdpSyncErrorDefinitions.credentialMissing, {
                        context: {
                            commandName: tdpSyncCommandNames.connectTdpSession,
                            nodeId: context.localNodeId as any,
                        },
                    })
                }

                clearReconnectTimer()
                manualDisconnect = false
                context.dispatchAction(tdpSyncStateActions.setStatus(
                    options?.isReconnect ? 'RECONNECTING' : 'CONNECTING',
                ))

                await socketBinding.socketRuntime.connect(socketBinding.profileName, {
                    query: {
                        terminalId,
                        token: accessToken,
                    },
                })

                sendHandshake()

                return {
                    terminalId,
                    accessToken,
                    lastCursor: selectTdpSyncState(context.getState())?.lastCursor,
                }
            }

            const scheduleReconnect = (reason?: string) => {
                if (!socketBinding || manualDisconnect) {
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
                context.dispatchAction(tdpSyncStateActions.setStatus('RECONNECTING'))
                context.dispatchAction(tdpSyncStateActions.setReconnectAttempt(reconnectAttempt))
                context.dispatchAction(tdpSyncStateActions.setDisconnectReason(reason ?? null))
                context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason(reason ?? null))

                reconnectTimer = setTimeout(() => {
                    reconnectTimer = undefined
                    void startSocketConnection({isReconnect: true}).catch(error => {
                        const resolved = createAppError(tdpSyncErrorDefinitions.handshakeFailed, {
                            args: {
                                error: error instanceof Error ? error.message : String(error),
                            },
                            details: error,
                        })
                        context.dispatchAction(tdpSyncStateActions.setLastProtocolError(resolved))
                        scheduleReconnect(
                            error instanceof Error ? error.message : String(error),
                        )
                    })
                }, getReconnectDelayMs())
            }

            if (socketBinding?.profile) {
                socketBinding.socketRuntime.registerProfile(socketBinding.profile)
            }

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'tdp-sync-runtime-install',
                message: 'install tdp sync runtime contents',
                data: {
                    moduleName,
                    stateSlices: tdpSyncStateSlices.map(slice => slice.name),
                    commandNames: Object.values(tdpSyncCommandNames),
                    socketProfileName: socketBinding?.profileName ?? TDP_SYNC_SOCKET_PROFILE_NAME,
                },
            })

            context.subscribeState(() => {
                topicChangePublishDirty = true
                if (topicChangePublishRunning) {
                    return
                }

                topicChangePublishRunning = true
                void (async () => {
                    try {
                        while (topicChangePublishDirty) {
                            topicChangePublishDirty = false
                            await publishTopicDataChanges(context, topicChangeFingerprint)
                        }
                    } finally {
                        topicChangePublishRunning = false
                    }
                })()
            })

            if (socketBinding) {
                socketBinding.socketRuntime.on(socketBinding.profileName, 'connected', () => {
                    clearReconnectTimer()
                    context.dispatchAction(tdpSyncStateActions.setStatus('HANDSHAKING'))
                })
                socketBinding.socketRuntime.on(socketBinding.profileName, 'reconnecting', event => {
                    if (!isReconnectingEvent(event)) {
                        return
                    }
                    context.dispatchAction(tdpSyncStateActions.setStatus('RECONNECTING'))
                    context.dispatchAction(tdpSyncStateActions.setReconnectAttempt(event.attempt))
                })
                socketBinding.socketRuntime.on(socketBinding.profileName, 'disconnected', event => {
                    if (!isDisconnectedEvent(event)) {
                        return
                    }
                    context.dispatchAction(tdpSyncStateActions.setStatus('DISCONNECTED'))
                    context.dispatchAction(tdpSyncStateActions.setDisconnectReason(event.reason ?? null))
                    context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason(event.reason ?? null))
                    scheduleReconnect(event.reason)
                })
                socketBinding.socketRuntime.on(socketBinding.profileName, 'error', event => {
                    if (!isErrorEvent(event)) {
                        return
                    }
                    const error = createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {
                            error: event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                        },
                        details: event.error,
                    })
                    context.dispatchAction(tdpSyncStateActions.setLastProtocolError(error))
                    scheduleReconnect(
                        event.error instanceof Error ? event.error.message : String(event.error),
                    )
                })
                socketBinding.socketRuntime.on(socketBinding.profileName, 'message', event => {
                    if (!isMessageEvent(event)) {
                        return
                    }
                    if (event.message.type === 'SESSION_READY') {
                        reconnectAttempt = 0
                    }
                    applyServerMessage(context, input, event.message)
                })
            }

            context.registerHandler(
                tdpSyncCommandNames.bootstrapTdpSync,
                async handlerContext => {
                    context.dispatchAction(tdpSyncStateActions.resetSession())
                    context.dispatchAction(tdpSyncStateActions.resetRuntimeState())
                    context.dispatchAction(tdpSyncStateActions.resetCommandInbox())
                    context.dispatchAction(tdpSyncStateActions.setLastProtocolError(null))
                    context.dispatchAction(tdpSyncStateActions.setLastEdgeDegraded(null))
                    context.dispatchAction(tdpSyncStateActions.setLastRehomeRequired(null))
                    context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason(null))

                    await handlerContext.dispatchChild({
                        commandName: tdpSyncCommandNames.bootstrapTdpSyncSucceeded,
                        payload: {},
                        internal: true,
                    })

                    clearReconnectTimer()
                    reconnectAttempt = 0
                    manualDisconnect = false

                    return {
                        lastCursor: selectTdpSyncState(handlerContext.getState())?.lastCursor,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.bootstrapTdpSyncSucceeded,
                async () => ({}),
            )

            context.registerHandler(
                tdpSyncCommandNames.connectTdpSession,
                async handlerContext => {
                    const state = handlerContext.getState()
                    const terminalId = selectTcpTerminalId(state)
                    const accessToken = selectTcpAccessToken(state)
                    if (!terminalId || !accessToken) {
                        throw createAppError(tdpSyncErrorDefinitions.credentialMissing, {
                            context: {
                                commandName: handlerContext.command.commandName,
                                commandId: handlerContext.command.commandId,
                                requestId: handlerContext.command.requestId,
                                sessionId: handlerContext.command.sessionId,
                                nodeId: context.localNodeId as any,
                            },
                        })
                    }

                    reconnectAttempt = 0
                    const result = await startSocketConnection()
                    return result
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.disconnectTdpSession,
                async () => {
                    manualDisconnect = true
                    clearReconnectTimer()
                    if (socketBinding) {
                        socketBinding.socketRuntime.disconnect(socketBinding.profileName, 'command-disconnect')
                    }
                    context.dispatchAction(tdpSyncStateActions.setStatus('DISCONNECTED'))
                    context.dispatchAction(tdpSyncStateActions.setDisconnectReason('command-disconnect'))
                    context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason('command-disconnect'))
                    return {}
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.acknowledgeCursor,
                async handlerContext => {
                    const payload = handlerContext.command.payload as {
                        cursor: number
                        topic?: string
                        itemKey?: string
                        instanceId?: string
                    }
                    sendAck(context, input, payload)
                    context.dispatchAction(tdpSyncStateActions.setLastAckedCursor(payload.cursor))
                    return {
                        cursor: payload.cursor,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.reportAppliedCursor,
                async handlerContext => {
                    const payload = handlerContext.command.payload as {
                        cursor: number
                        connectionMetrics?: Record<string, unknown>
                        localStoreMetrics?: Record<string, unknown>
                    }
                    sendStateReport(context, input, payload)
                    context.dispatchAction(tdpSyncStateActions.setLastAppliedCursor(payload.cursor))
                    return {
                        cursor: payload.cursor,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.sendPing,
                async () => {
                    if (socketBinding) {
                        socketBinding.socketRuntime.send(socketBinding.profileName, {
                            type: 'PING',
                        })
                    }
                    return {}
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSocketConnected,
                async () => ({}),
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSocketReconnecting,
                async handlerContext => {
                    const payload = handlerContext.command.payload as {attempt: number}
                    context.dispatchAction(tdpSyncStateActions.setStatus('RECONNECTING'))
                    context.dispatchAction(tdpSyncStateActions.setReconnectAttempt(payload.attempt))
                    return payload
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSocketDisconnected,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as {reason?: string}
                    context.dispatchAction(tdpSyncStateActions.setStatus('DISCONNECTED'))
                    context.dispatchAction(tdpSyncStateActions.setDisconnectReason(payload.reason ?? null))
                    context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason(payload.reason ?? null))
                    return {
                        reason: payload.reason,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSocketErrored,
                async handlerContext => {
                    const payload = (handlerContext.command.payload ?? {}) as {error: unknown}
                    const error = createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {
                            error: payload.error instanceof Error
                                ? payload.error.message
                                : String(payload.error),
                        },
                        details: payload.error,
                    })
                    context.dispatchAction(tdpSyncStateActions.setStatus('ERROR'))
                    context.dispatchAction(tdpSyncStateActions.setLastProtocolError(error))
                    throw error
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSocketHeartbeatTimedOut,
                async () => {
                    context.dispatchAction(tdpSyncStateActions.setStatus('RECONNECTING'))
                    context.dispatchAction(tdpSyncStateActions.setDisconnectReason('heartbeat-timeout'))
                    context.dispatchAction(tdpSyncStateActions.setLastDisconnectReason('heartbeat-timeout'))
                    scheduleReconnect('heartbeat-timeout')
                    return {}
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpMessageReceived,
                async handlerContext => {
                    const payload = handlerContext.command.payload as TdpServerMessage
                    applyServerMessage(context, input, payload)
                    return {
                        messageType: payload.type,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSessionReady,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'SESSION_READY'}>['data']
                    reconnectAttempt = 0
                    dispatchReducedMessage(context, {
                        type: 'SESSION_READY',
                        data: payload,
                    })
                    return payload
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSnapshotLoaded,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'FULL_SNAPSHOT'}>['data']
                    applyServerMessage(context, input, {
                        type: 'FULL_SNAPSHOT',
                        data: payload,
                    })
                    return {
                        size: payload.snapshot.length,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpChangesLoaded,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'CHANGESET'}>['data']
                    applyServerMessage(context, input, {
                        type: 'CHANGESET',
                        data: payload,
                    })
                    return {
                        size: payload.changes.length,
                        nextCursor: payload.nextCursor,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpProjectionReceived,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'PROJECTION_CHANGED'}>['data']
                    applyServerMessage(context, input, {
                        type: 'PROJECTION_CHANGED',
                        eventId: `evt_${payload.cursor}`,
                        timestamp: Date.now(),
                        data: payload,
                    })
                    return {
                        cursor: payload.cursor,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpProjectionBatchReceived,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'PROJECTION_BATCH'}>['data']
                    applyServerMessage(context, input, {
                        type: 'PROJECTION_BATCH',
                        eventId: `batch_${payload.nextCursor}`,
                        timestamp: Date.now(),
                        data: payload,
                    })
                    return {
                        size: payload.changes.length,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpCommandDelivered,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'COMMAND_DELIVERED'}>['data']
                    applyServerMessage(context, input, {
                        type: 'COMMAND_DELIVERED',
                        eventId: payload.commandId,
                        timestamp: Date.now(),
                        data: payload,
                    })
                    return {
                        commandId: payload.commandId,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpPongReceived,
                async handlerContext => {
                    const payload = handlerContext.command.payload as {timestamp: number}
                    dispatchReducedMessage(context, {
                        type: 'PONG',
                        data: payload,
                    })
                    return payload
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpEdgeDegraded,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'EDGE_DEGRADED'}>['data']
                    dispatchReducedMessage(context, {
                        type: 'EDGE_DEGRADED',
                        data: payload,
                    })
                    return {
                        reason: payload.reason,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpSessionRehomeRequired,
                async handlerContext => {
                    const payload = handlerContext.command.payload as Extract<TdpServerMessage, {type: 'SESSION_REHOME_REQUIRED'}>['data']
                    dispatchReducedMessage(context, {
                        type: 'SESSION_REHOME_REQUIRED',
                        data: payload,
                    })
                    return {
                        reason: payload.reason,
                    }
                },
            )

            context.registerHandler(
                tdpSyncCommandNames.tdpProtocolFailed,
                async handlerContext => {
                    const payload = handlerContext.command.payload as {error: unknown}
                    const error = createAppError(tdpSyncErrorDefinitions.protocolError, {
                        args: {
                            error: payload.error instanceof Error
                                ? payload.error.message
                                : typeof payload.error === 'object' && payload.error && 'message' in payload.error
                                    ? String((payload.error as {message?: unknown}).message)
                                    : String(payload.error),
                        },
                        details: payload.error,
                    })
                    context.dispatchAction(tdpSyncStateActions.setStatus('ERROR'))
                    context.dispatchAction(tdpSyncStateActions.setLastProtocolError(error))
                    throw error
                },
            )
        },
    }
}
