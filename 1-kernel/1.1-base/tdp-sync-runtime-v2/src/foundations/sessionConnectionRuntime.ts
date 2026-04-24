import {
    createAppError,
    isAppError,
    packageVersion,
    protocolVersion,
} from '@next/kernel-base-contracts'
import type {RuntimeModuleContextV2} from '@next/kernel-base-runtime-shell-v2'
import {
    createHttpRuntime,
    createSocketLifecycleController,
    type HttpSuccessResponse,
    type HttpTransport,
    type HttpTransportRequest,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {moduleName} from '../moduleName'
import {
    selectTcpAccessToken,
    selectTcpSandboxId,
    selectTcpTerminalId,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {selectTopologyRuntimeV3Context} from '@next/kernel-base-topology-runtime-v3'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {tdpSyncV2StateActions} from '../features/slices'
import {TDP_SYNC_V2_SOCKET_PROFILE_NAME, tdpSyncV2SocketProfile} from './socketBinding'
import {selectTdpSessionState, selectTdpSyncState} from '../selectors'
import {tdpSyncV2ErrorDefinitions, tdpSyncV2ParameterDefinitions} from '../supports'
import type {
    CreateTdpSyncRuntimeModuleV2Input,
    TdpClientMessage,
    TdpServerMessage,
    TdpSessionConnectionRuntimeV2,
    TdpSessionConnectionRuntimeRefV2,
} from '../types'

/**
 * 设计意图：
 * 这里把 TDP 会话连接逻辑从 actor 中抽离出来，统一管理 snapshot、changes、WS session 和断线恢复节奏。
 * 这样 actor 保持业务语义清晰，底层 transport/connection 细节留在独立运行时对象中维护。
 */
const DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL = 'http://127.0.0.1:5810'
const DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME = 'local-default'

const isMessageEvent = (
    event: {type: string},
): event is {type: 'message'; message: TdpServerMessage} => event.type === 'message'

const isDisconnectedEvent = (
    event: {type: string},
): event is {type: 'disconnected'; reason?: string} => event.type === 'disconnected'

const isErrorEvent = (
    event: {type: string},
): event is {type: 'error'; error: unknown} => event.type === 'error'

const createFetchHttpTransport = (): HttpTransport => ({
    async execute<TPath, TQuery, TBody, TResponse>(
        request: HttpTransportRequest<TPath, TQuery, TBody>,
    ): Promise<HttpSuccessResponse<TResponse>> {
        const response = await fetch(request.url, {
            method: request.endpoint.method,
            headers: {
                'content-type': 'application/json',
                ...(request.input.headers ?? {}),
            },
            body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
        })

        return {
            data: await response.json() as TResponse,
            status: response.status,
            statusText: response.statusText,
            headers: (() => {
                const headers: Record<string, string> = {}
                response.headers.forEach((value: string, key: string) => {
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
        moduleName,
        subsystem: 'transport.http',
        component: 'TdpSyncHttpRuntimeV2',
    }),
    transport: createFetchHttpTransport(),
    servers: [
        {
            serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
            addresses: [
                {
                    addressName: DEFAULT_MOCK_TERMINAL_PLATFORM_ADDRESS_NAME,
                    baseUrl: DEFAULT_MOCK_TERMINAL_PLATFORM_BASE_URL,
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

    const sendHandshake = () => {
        const state = input.context.getState()
        const sandboxId = selectTcpSandboxId(state)
        const terminalId = selectTcpTerminalId(state)
        const accessToken = selectTcpAccessToken(state)
        const topologyContext = selectTopologyRuntimeV3Context(state)
        if (!sandboxId || !terminalId || !accessToken) {
            throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
                args: {error: !sandboxId ? 'sandboxId is missing' : 'tcp credential is missing'},
                context: {
                    commandName: tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
                    nodeId: input.context.localNodeId,
                },
            })
        }

        const handshakeMessage: TdpClientMessage = {
            type: 'HANDSHAKE',
            data: {
                sandboxId,
                terminalId,
                appVersion: packageVersion,
                lastCursor: selectTdpSyncState(state)?.lastCursor,
                protocolVersion,
                runtimeIdentity: {
                    localNodeId: String(input.context.localNodeId),
                    displayIndex: input.context.displayContext.displayIndex ?? topologyContext?.displayIndex ?? 0,
                    displayCount: input.context.displayContext.displayCount ?? topologyContext?.displayCount ?? 1,
                    instanceMode: topologyContext?.instanceMode,
                    displayMode: topologyContext?.displayMode,
                },
            },
        }

        socketBinding.socketRuntime.send(socketBinding.profileName, handshakeMessage)
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus('HANDSHAKING'))
    }

    let lastConnectionStartResult: Record<string, unknown> | undefined

    const performSocketConnection = async (options?: {isReconnect?: boolean}) => {
        const currentState = socketBinding.socketRuntime.getConnectionState(socketBinding.profileName)
        if (currentState === 'connected' || currentState === 'connecting') {
            const sessionStatus = selectTdpSessionState(input.context.getState())?.status
            if (currentState === 'connected' && sessionStatus !== 'READY' && sessionStatus !== 'HANDSHAKING') {
                sendHandshake()
                return {
                    rehandshaken: true,
                    lastCursor: selectTdpSyncState(input.context.getState())?.lastCursor,
                    previousSessionStatus: sessionStatus,
                }
            }
            return {
                alreadyConnected: currentState === 'connected',
                alreadyConnecting: currentState === 'connecting',
                lastCursor: selectTdpSyncState(input.context.getState())?.lastCursor,
            }
        }

        const state = input.context.getState()
        const sandboxId = selectTcpSandboxId(state)
        const terminalId = selectTcpTerminalId(state)
        const accessToken = selectTcpAccessToken(state)
        if (!sandboxId || !terminalId || !accessToken) {
            throw createAppError(tdpSyncV2ErrorDefinitions.credentialMissing, {
                args: {error: !sandboxId ? 'sandboxId is missing' : 'tcp credential is missing'},
                context: {
                    commandName: tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
                    nodeId: input.context.localNodeId,
                },
            })
        }
        input.context.dispatchAction(tdpSyncV2StateActions.setStatus(
            options?.isReconnect ? 'RECONNECTING' : 'CONNECTING',
        ))

        await socketBinding.socketRuntime.connect(socketBinding.profileName, {
            query: {
                sandboxId,
                terminalId,
                token: accessToken,
            },
        })

        // socketRuntime.connect resolve 后才保证 transportConnection 已可用；
        // 握手若延后到 connected 事件里，事件可能早于 transportConnection 赋值，导致 send 被静默丢弃。
        sendHandshake()

        return {
            sandboxId,
            terminalId,
            accessToken,
            lastCursor: selectTdpSyncState(input.context.getState())?.lastCursor,
        }
    }

    const lifecycle = createSocketLifecycleController({
        async connect(options) {
            lastConnectionStartResult = await performSocketConnection(options)
        },
        disconnect(reason) {
            socketBinding.socketRuntime.disconnect(socketBinding.profileName, reason)
        },
        attachListeners(handlers) {
            socketBinding.socketRuntime.on(socketBinding.profileName, 'connected', () => {
                handlers.connected()
            })
            socketBinding.socketRuntime.on(socketBinding.profileName, 'disconnected', event => {
                if (!isDisconnectedEvent(event)) {
                    return
                }
                handlers.disconnected(event.reason)
            })
            socketBinding.socketRuntime.on(socketBinding.profileName, 'error', event => {
                if (!isErrorEvent(event)) {
                    return
                }
                handlers.error(event.error)
            })
        },
        resolveReconnectPolicy() {
            return {
                attempts: getReconnectAttempts(input.context, input.moduleInput),
                delayMs: resolveReconnectDelayMs(input.context, input.moduleInput),
            }
        },
        shouldReconnect() {
            return true
        },
        shouldReconnectOnConnectError(error) {
            return !isAppError(error)
        },
        onConnected() {},
        onDisconnected(reason) {
            input.context.dispatchAction(tdpSyncV2StateActions.setStatus('DISCONNECTED'))
            input.context.dispatchAction(tdpSyncV2StateActions.setDisconnectReason(reason ?? null))
            input.context.dispatchAction(tdpSyncV2StateActions.setLastDisconnectReason(reason ?? null))
        },
        onReconnectScheduled({reason, attempt}) {
            input.context.dispatchAction(tdpSyncV2StateActions.setStatus('RECONNECTING'))
            input.context.dispatchAction(tdpSyncV2StateActions.setReconnectAttempt(attempt))
            input.context.dispatchAction(tdpSyncV2StateActions.setDisconnectReason(reason ?? null))
            input.context.dispatchAction(tdpSyncV2StateActions.setLastDisconnectReason(reason ?? null))
        },
    })

    socketBinding.socketRuntime.on(socketBinding.profileName, 'message', event => {
        if (!isMessageEvent(event)) {
            return
        }
        if (event.message.type === 'SESSION_READY') {
            lifecycle.resetReconnectAttempt()
        }
        void input.context.dispatchCommand({
            definition: tdpSyncV2CommandDefinitions.tdpMessageReceived,
            payload: event.message,
        }).catch(error => {
            input.context.platformPorts.logger.error({
                category: 'tdp.connection',
                event: 'message-dispatch-failed',
                message: 'TDP server message dispatch failed',
                error: {
                    name: error instanceof Error ? error.name : undefined,
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            })
        })
    })
    lifecycle.attach()

    const runtime: TdpSessionConnectionRuntimeV2 = {
        async startSocketConnection(options?: {isReconnect?: boolean}) {
            await lifecycle.start(options)
            return lastConnectionStartResult ?? {}
        },
        disconnect(reason?: string) {
            lifecycle.stop(reason)
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
