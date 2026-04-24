import {
    createAppError,
    createConnectionId,
    nowTimestampMs,
} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {
    CreateSocketRuntimeInput,
    SocketConnectionMetric,
    SocketConnectionProfile,
    SocketConnectionState,
    SocketEvent,
    SocketEventListener,
    SocketEventType,
    SocketResolvedConnection,
    SocketRuntime,
    SocketTransportConnection,
} from '../types'
import {createServerCatalog} from './serverCatalog'
import {buildSocketUrl} from './socketProfile'
import {transportRuntimeErrorDefinitions} from '../supports'

/**
 * 设计意图：
 * socket runtime 只关心 WS 连接本身，不关心 TDP、拓扑或 UI 具体协议。
 * 各上层包通过不同的 socket profile 和消息 codec 复用这套基础设施，保证重连与消息收发语义一致。
 */
interface ManagedSocketConnection {
    profile: SocketConnectionProfile<any, any, any, any, any>
    readonly connectionId: ReturnType<typeof createConnectionId>
    state: SocketConnectionState
    resolved?: SocketResolvedConnection<any, any, any, any, any>
    transportConnection?: SocketTransportConnection
    reconnectAttempt: number
    connectedAt?: number
    inboundMessageCount: number
    outboundMessageCount: number
    listeners: Map<SocketEventType, Set<SocketEventListener<any>>>
}

const createSocketLogger = (logger: LoggerPort): LoggerPort => {
    return logger.scope({
        subsystem: 'transport.ws',
        component: 'SocketRuntime',
    })
}

const emitEvent = <TIncoming>(
    connection: ManagedSocketConnection,
    event: SocketEvent<TIncoming>,
) => {
    connection.listeners.get(event.type)?.forEach(listener => {
        listener(event)
    })
}

const setState = (
    connection: ManagedSocketConnection,
    nextState: SocketConnectionState,
) => {
    const previousState = connection.state
    connection.state = nextState
    emitEvent(connection, {
        type: 'state-change',
        connectionId: connection.resolved?.connectionId ?? connection.connectionId,
        previousState,
        nextState,
        occurredAt: nowTimestampMs(),
    })
}

export const createSocketRuntime = (
    input: CreateSocketRuntimeInput,
): SocketRuntime => {
    const serverCatalog = createServerCatalog()
    const logger = createSocketLogger(input.logger)
    const connections = new Map<string, ManagedSocketConnection>()
    const preferredAddressByServer = new Map<string, string>()
    let currentServers = input.servers

    const refreshServers = () => {
        const servers = currentServers ?? input.serverProvider?.() ?? []
        serverCatalog.replaceServers(servers)
    }

    const getConnection = (profileName: string): ManagedSocketConnection => {
        const connection = connections.get(profileName)
        if (!connection) {
            throw createAppError(transportRuntimeErrorDefinitions.socketRuntimeFailed, {
                args: {profileName},
                details: {profileName},
            })
        }
        return connection
    }

    const resolveRoundAddresses = (serverName: string) => {
        const addresses = [...serverCatalog.resolveAddresses(serverName)]
        const preferredAddressName = preferredAddressByServer.get(serverName)
        if (!preferredAddressName) {
            return addresses
        }
        const preferredAddress = addresses.find(address => address.addressName === preferredAddressName)
        if (!preferredAddress) {
            preferredAddressByServer.delete(serverName)
            return addresses
        }
        return [
            preferredAddress,
            ...addresses.filter(address => address.addressName !== preferredAddressName),
        ]
    }

    const rememberPreferredAddress = (serverName: string, addressName: string) => {
        preferredAddressByServer.set(serverName, addressName)
    }

    const finalizeMetric = (
        connection: ManagedSocketConnection,
        success: boolean,
        disconnectReason?: string,
    ) => {
        if (!connection.resolved || !connection.connectedAt) {
            return
        }

        const endedAt = nowTimestampMs()
        const metric: SocketConnectionMetric = {
            profileName: connection.profile.name,
            serverName: connection.profile.serverName,
            connectionId: connection.resolved.connectionId,
            selectedAddressName: connection.resolved.selectedAddress.addressName,
            url: connection.resolved.url,
            startedAt: connection.connectedAt,
            endedAt,
            durationMs: endedAt - connection.connectedAt,
            success,
            disconnectReason,
            inboundMessageCount: connection.inboundMessageCount,
            outboundMessageCount: connection.outboundMessageCount,
        }

        input.metricsRecorder?.recordConnection(metric)
    }

    const connect = async <TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        profileName: string,
        inputValue: {
            path?: TPath
            query?: TQuery
            headers?: THeaders
            context?: {
                requestId?: any
                commandId?: any
                sessionId?: any
                nodeId?: any
                peerNodeId?: any
                metadata?: Record<string, unknown>
            }
        } = {},
    ): Promise<SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing>> => {
        refreshServers()
        const connection = getConnection(profileName)
        const headers = Object.fromEntries(
            Object.entries((inputValue.headers as Record<string, unknown> | undefined) ?? {})
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, String(value)]),
        )
        const addresses = resolveRoundAddresses(connection.profile.serverName)
        let lastError: unknown

        for (const address of addresses) {
            const resolved: SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing> = {
                connectionId: createConnectionId(),
                profile: connection.profile as SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
                url: buildSocketUrl(
                    address.baseUrl,
                    connection.profile.pathTemplate,
                    inputValue.path as Record<string, unknown> | undefined,
                    inputValue.query as Record<string, unknown> | undefined,
                ),
                headers,
                selectedAddress: address,
                timeoutMs: connection.profile.meta.connectionTimeoutMs ?? address.timeoutMs,
            }

            connection.resolved = resolved
            connection.connectedAt = nowTimestampMs()
            connection.inboundMessageCount = 0
            connection.outboundMessageCount = 0
            connection.transportConnection = undefined
            setState(connection, 'connecting')

            logger.info({
                category: 'transport.ws',
                event: 'connect-started',
                message: `Socket connect started: ${profileName}`,
                context: {
                    ...inputValue.context,
                    connectionId: resolved.connectionId,
                },
                data: {
                    profileName,
                    serverName: connection.profile.serverName,
                    addressName: address.addressName,
                },
            })

            try {
                connection.transportConnection = await input.transport.connect(resolved, {
                    onOpen() {
                        rememberPreferredAddress(connection.profile.serverName, resolved.selectedAddress.addressName)
                        setState(connection, 'connected')
                        emitEvent(connection, {
                            type: 'connected',
                            connectionId: resolved.connectionId,
                            url: resolved.url,
                            addressName: resolved.selectedAddress.addressName,
                            occurredAt: nowTimestampMs(),
                        })
                    },
                    onMessage(raw) {
                        connection.inboundMessageCount += 1
                        const parsed = connection.profile.codec.deserialize(raw)
                        emitEvent(connection, {
                            type: 'message',
                            connectionId: resolved.connectionId,
                            message: parsed,
                            occurredAt: nowTimestampMs(),
                        })
                    },
                    onClose(reason) {
                        finalizeMetric(connection, true, reason)
                        setState(connection, 'disconnected')
                        emitEvent(connection, {
                            type: 'disconnected',
                            connectionId: resolved.connectionId,
                            reason,
                            occurredAt: nowTimestampMs(),
                        })
                    },
                    onError(error) {
                        finalizeMetric(connection, false)
                        setState(connection, 'disconnected')
                        emitEvent(connection, {
                            type: 'error',
                            connectionId: resolved.connectionId,
                            error,
                            occurredAt: nowTimestampMs(),
                        })
                    },
                })

                return resolved
            } catch (error) {
                finalizeMetric(connection, false)
                setState(connection, 'disconnected')
                connection.transportConnection = undefined
                lastError = error
            }
        }

        throw createAppError(transportRuntimeErrorDefinitions.socketRuntimeFailed, {
            args: {profileName},
            details: {
                profileName,
                serverName: connection.profile.serverName,
                cause: lastError,
            },
            context: {
                requestId: inputValue.context?.requestId,
                commandId: inputValue.context?.commandId,
                sessionId: inputValue.context?.sessionId,
                nodeId: inputValue.context?.nodeId,
            },
            cause: lastError,
        })
    }

    refreshServers()

    return {
        registerProfile(profile) {
            const existingConnection = connections.get(profile.name)
            if (existingConnection) {
                existingConnection.profile = profile
                return
            }
            connections.set(profile.name, {
                connectionId: createConnectionId(),
                profile,
                state: 'disconnected',
                reconnectAttempt: 0,
                inboundMessageCount: 0,
                outboundMessageCount: 0,
                listeners: new Map(),
            })
        },
        connect,
        send(profileName, message) {
            const connection = getConnection(profileName)
            if (!connection.transportConnection) {
                return
            }
            connection.transportConnection.sendRaw(connection.profile.codec.serialize(message))
            connection.outboundMessageCount += 1
        },
        disconnect(profileName, reason) {
            const connection = getConnection(profileName)
            connection.transportConnection?.disconnect(reason)
        },
        getConnectionState(profileName) {
            return getConnection(profileName).state
        },
        on(profileName, eventType, listener) {
            const connection = getConnection(profileName)
            const listeners = connection.listeners.get(eventType) ?? new Set()
            listeners.add(listener)
            connection.listeners.set(eventType, listeners)
        },
        off(profileName, eventType, listener) {
            getConnection(profileName).listeners.get(eventType)?.delete(listener)
        },
        replaceServers(servers) {
            currentServers = servers
            serverCatalog.replaceServers(servers)
            preferredAddressByServer.clear()
        },
        getServerCatalog() {
            return serverCatalog
        },
    }
}
