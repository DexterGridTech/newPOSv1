import {
    createAppError,
    createConnectionId,
    nowTimestampMs,
} from '@impos2/kernel-base-contracts'
import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
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

const SOCKET_RUNTIME_FAILED_ERROR: ErrorDefinition = {
    key: 'kernel.base.transport-runtime.socket_runtime_failed',
    name: 'Socket Runtime Failed',
    defaultTemplate: 'Socket runtime failed for ${profileName}',
    category: 'NETWORK',
    severity: 'MEDIUM',
    moduleName: 'kernel.base.transport-runtime',
}

interface ManagedSocketConnection {
    readonly profile: SocketConnectionProfile<any, any, any, any, any>
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
        connectionId: connection.resolved?.connectionId ?? createConnectionId(),
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

    const refreshServers = () => {
        const servers = input.servers ?? input.serverProvider?.() ?? []
        serverCatalog.replaceServers(servers)
    }

    const getConnection = (profileName: string): ManagedSocketConnection => {
        const connection = connections.get(profileName)
        if (!connection) {
            throw createAppError(SOCKET_RUNTIME_FAILED_ERROR, {
                args: {profileName},
                details: {profileName},
            })
        }
        return connection
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
        const address = serverCatalog.resolveAddresses(connection.profile.serverName)[0]
        const resolved: SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing> = {
            connectionId: createConnectionId(),
            profile: connection.profile as SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
            url: buildSocketUrl(
                address.baseUrl,
                connection.profile.pathTemplate,
                inputValue.path as Record<string, unknown> | undefined,
                inputValue.query as Record<string, unknown> | undefined,
            ),
            headers: Object.fromEntries(
                Object.entries((inputValue.headers as Record<string, unknown> | undefined) ?? {})
                    .filter(([, value]) => value !== undefined && value !== null)
                    .map(([key, value]) => [key, String(value)]),
            ),
            selectedAddress: address,
            timeoutMs: connection.profile.meta.connectionTimeoutMs ?? address.timeoutMs,
        }

        connection.resolved = resolved
        connection.connectedAt = nowTimestampMs()
        connection.inboundMessageCount = 0
        connection.outboundMessageCount = 0
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

        connection.transportConnection = await input.transport.connect(resolved, {
            onOpen() {
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

                const maxAttempts = connection.profile.meta.reconnectAttempts ?? 0
                const canReconnect = maxAttempts < 0 || connection.reconnectAttempt < maxAttempts
                if (!canReconnect) {
                    return
                }

                connection.reconnectAttempt += 1
                setState(connection, 'reconnecting')
                emitEvent(connection, {
                    type: 'reconnecting',
                    connectionId: resolved.connectionId,
                    attempt: connection.reconnectAttempt,
                    occurredAt: nowTimestampMs(),
                })
            },
            onError(error) {
                finalizeMetric(connection, false)
                emitEvent(connection, {
                    type: 'error',
                    connectionId: resolved.connectionId,
                    error,
                    occurredAt: nowTimestampMs(),
                })
            },
        })

        return resolved
    }

    refreshServers()

    return {
        registerProfile(profile) {
            connections.set(profile.name, {
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
            connection.outboundMessageCount += 1
            connection.transportConnection?.sendRaw(connection.profile.codec.serialize(message))
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
            serverCatalog.replaceServers(servers)
        },
        getServerCatalog() {
            return serverCatalog
        },
    }
}
