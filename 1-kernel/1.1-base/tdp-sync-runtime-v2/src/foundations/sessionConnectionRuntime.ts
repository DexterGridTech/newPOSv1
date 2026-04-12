import {
    createAppError,
    packageVersion,
    protocolVersion,
} from '@impos2/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createHttpRuntime, type HttpTransport} from '@impos2/kernel-base-transport-runtime'
import {
    selectTcpAccessToken,
    selectTcpTerminalId,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {tdpSyncV2StateActions} from '../features/slices'
import {TDP_SYNC_V2_SOCKET_PROFILE_NAME, tdpSyncV2SocketProfile} from './socketBinding'
import {selectTdpSyncState} from '../selectors'
import {tdpSyncV2ErrorDefinitions, tdpSyncV2ParameterDefinitions} from '../supports'
import type {
    CreateTdpSyncRuntimeModuleV2Input,
    TdpClientMessage,
    TdpServerMessage,
    TdpSessionConnectionRuntimeV2,
    TdpSessionConnectionRuntimeRefV2,
} from '../types'

const isMessageEvent = (
    event: {type: string},
): event is {type: 'message'; message: TdpServerMessage} => event.type === 'message'

const isDisconnectedEvent = (
    event: {type: string},
): event is {type: 'disconnected'; reason?: string} => event.type === 'disconnected'

const isErrorEvent = (
    event: {type: string},
): event is {type: 'error'; error: unknown} => event.type === 'error'

const isReconnectingEvent = (
    event: {type: string},
): event is {type: 'reconnecting'; attempt: number} => event.type === 'reconnecting'

const createFetchHttpTransport = (): HttpTransport => ({
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
})

export const createDefaultTdpSyncHttpRuntimeV2 = (
    context: RuntimeModuleContextV2,
) => createHttpRuntime({
    logger: context.platformPorts.logger.scope({
        moduleName: 'kernel.base.tdp-sync-runtime-v2',
        subsystem: 'transport.http',
        component: 'TdpSyncHttpRuntimeV2',
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

const getReconnectAttempts = (
    context: RuntimeModuleContextV2,
    input: CreateTdpSyncRuntimeModuleV2Input,
) => {
    const parameterValue = context.getState()?.['kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>] as Record<string, {rawValue?: unknown}> | undefined
    const override = parameterValue?.[tdpSyncV2ParameterDefinitions.tdpReconnectAttempts.key]?.rawValue
    if (typeof override === 'number' && Number.isInteger(override)) {
        return override
    }
    if (input.socket?.reconnectAttempts != null) {
        return input.socket.reconnectAttempts
    }
    if (context.platformPorts.environmentMode === 'PROD') {
        return -1
    }
    return tdpSyncV2ParameterDefinitions.tdpReconnectAttempts.defaultValue
}

const resolveReconnectDelayMs = (
    context: RuntimeModuleContextV2,
    input: CreateTdpSyncRuntimeModuleV2Input,
) => {
    if (input.socket?.reconnectIntervalMs != null) {
        return input.socket.reconnectIntervalMs
    }
    const parameterValue = context.getState()?.['kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>] as Record<string, {rawValue?: unknown}> | undefined
    const override = parameterValue?.[tdpSyncV2ParameterDefinitions.tdpReconnectIntervalMs.key]?.rawValue
    if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
        return override
    }
    return tdpSyncV2ParameterDefinitions.tdpReconnectIntervalMs.defaultValue
}

export const installTdpSessionConnectionRuntimeV2 = (input: {
    context: RuntimeModuleContextV2
    moduleInput: CreateTdpSyncRuntimeModuleV2Input
    connectionRuntimeRef: TdpSessionConnectionRuntimeRefV2
}) => {
    const socketBinding = input.moduleInput.assembly?.resolveSocketBinding?.(input.context)
    if (!socketBinding) {
        return
    }

    const profile = socketBinding.profile ?? {
        ...tdpSyncV2SocketProfile,
        name: socketBinding.profileName || TDP_SYNC_V2_SOCKET_PROFILE_NAME,
    }
    socketBinding.socketRuntime.registerProfile({
        ...profile,
        meta: {
            ...profile.meta,
            reconnectAttempts: input.moduleInput.socket?.reconnectAttempts ?? profile.meta.reconnectAttempts,
        },
    })

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectAttempt = 0
    let manualDisconnect = false

    const clearReconnectTimer = () => {
        if (!reconnectTimer) {
            return
        }
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
    }

    const sendHandshake = () => {
        const state = input.context.getState()
        const terminalId = selectTcpTerminalId(state)
        const accessToken = selectTcpAccessToken(state)
        if (!terminalId || !accessToken) {
            throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
                context: {
                    commandName: tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
                    nodeId: input.context.localNodeId,
                },
            })
        }

        const handshakeMessage: TdpClientMessage = {
            type: 'HANDSHAKE',
            data: {
                terminalId,
                appVersion: packageVersion,
                lastCursor: selectTdpSyncState(state)?.lastCursor,
                protocolVersion,
            },
        }

        socketBinding.socketRuntime.send(socketBinding.profileName, handshakeMessage)
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('HANDSHAKING'))
    }

    const startSocketConnection = async (options?: {isReconnect?: boolean}) => {
        const state = input.context.getState()
        const terminalId = selectTcpTerminalId(state)
        const accessToken = selectTcpAccessToken(state)
        if (!terminalId || !accessToken) {
            throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
                context: {
                    commandName: tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
                    nodeId: input.context.localNodeId,
                },
            })
        }

        clearReconnectTimer()
        manualDisconnect = false
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus(
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
            lastCursor: selectTdpSyncState(input.context.getState())?.lastCursor,
        }
    }

    const scheduleReconnect = (reason?: string) => {
        if (manualDisconnect) {
            return
        }
        if (reconnectTimer) {
            return
        }

        const maxAttempts = getReconnectAttempts(input.context, input.moduleInput)
        if (maxAttempts >= 0 && reconnectAttempt >= maxAttempts) {
            return
        }

        reconnectAttempt += 1
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('RECONNECTING'))
        input.context.dispatchAction(tdpSyncV2StateActions.setReconnectAttempt(reconnectAttempt))
        input.context.dispatchAction(tdpSyncV2StateActions.setDisconnectReason(reason ?? null))
        input.context.dispatchAction(tdpSyncV2StateActions.setLastDisconnectReason(reason ?? null))

        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined
            void startSocketConnection({isReconnect: true}).catch(error => {
                scheduleReconnect(error instanceof Error ? error.message : String(error))
            })
        }, resolveReconnectDelayMs(input.context, input.moduleInput))
    }

    socketBinding.socketRuntime.on(socketBinding.profileName, 'connected', () => {
        clearReconnectTimer()
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('HANDSHAKING'))
    })
    socketBinding.socketRuntime.on(socketBinding.profileName, 'reconnecting', event => {
        if (!isReconnectingEvent(event)) {
            return
        }
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('RECONNECTING'))
        input.context.dispatchAction(tdpSyncV2StateActions.setReconnectAttempt(event.attempt))
    })
    socketBinding.socketRuntime.on(socketBinding.profileName, 'disconnected', event => {
        if (!isDisconnectedEvent(event)) {
            return
        }
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('DISCONNECTED'))
        input.context.dispatchAction(tdpSyncV2StateActions.setDisconnectReason(event.reason ?? null))
        input.context.dispatchAction(tdpSyncV2StateActions.setLastDisconnectReason(event.reason ?? null))
        scheduleReconnect(event.reason)
    })
    socketBinding.socketRuntime.on(socketBinding.profileName, 'error', event => {
        if (!isErrorEvent(event)) {
            return
        }
        scheduleReconnect(event.error instanceof Error ? event.error.message : String(event.error))
    })
    socketBinding.socketRuntime.on(socketBinding.profileName, 'message', event => {
        if (!isMessageEvent(event)) {
            return
        }
        if (event.message.type === 'SESSION_READY') {
            reconnectAttempt = 0
        }
        void input.context.dispatchCommand({
            definition: tdpSyncV2CommandDefinitions.tdpMessageReceived,
            payload: event.message,
        })
    })

    const runtime: TdpSessionConnectionRuntimeV2 = {
        startSocketConnection,
        disconnect(reason?: string) {
            manualDisconnect = true
            clearReconnectTimer()
            socketBinding.socketRuntime.disconnect(socketBinding.profileName, reason)
        },
        sendAck(payload: {cursor: number; topic?: string; itemKey?: string; instanceId?: string}) {
            socketBinding.socketRuntime.send(socketBinding.profileName, {
                type: 'ACK',
                data: payload,
            })
        },
        sendStateReport(payload: {
            cursor: number
            connectionMetrics?: Record<string, unknown>
            localStoreMetrics?: Record<string, unknown>
        }) {
            socketBinding.socketRuntime.send(socketBinding.profileName, {
                type: 'STATE_REPORT',
                data: {
                    lastAppliedCursor: payload.cursor,
                    connectionMetrics: payload.connectionMetrics,
                    localStoreMetrics: payload.localStoreMetrics,
                },
            })
        },
        sendPing() {
            socketBinding.socketRuntime.send(socketBinding.profileName, {type: 'PING'})
        },
    }

    input.connectionRuntimeRef.current = runtime
}
