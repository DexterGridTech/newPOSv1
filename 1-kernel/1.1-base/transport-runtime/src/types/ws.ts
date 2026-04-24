import type {
    AppError,
    ConnectionId,
    TimestampMs,
} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {TypeDescriptor} from './http'
import type {
    ServerCatalog,
    TransportRequestContext,
    TransportServerAddress,
    TransportServerDefinition,
} from './transport'

export type SocketConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'connected'

export interface SocketProfileMeta {
    readonly connectionTimeoutMs?: number
    readonly reconnectAttempts?: number
    readonly reconnectDelayMs?: number
    readonly heartbeatIntervalMs?: number
    readonly heartbeatTimeoutMs?: number
    readonly metadata?: Record<string, unknown>
}

export interface SocketCodec<TIncoming = unknown, TOutgoing = unknown> {
    serialize(message: TOutgoing): string
    deserialize(raw: string): TIncoming
}

export interface SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing> {
    readonly protocol: 'ws'
    readonly name: string
    readonly serverName: string
    readonly pathTemplate: string
    readonly handshake: {
        readonly path?: TypeDescriptor<TPath>
        readonly query?: TypeDescriptor<TQuery>
        readonly headers?: TypeDescriptor<THeaders>
    }
    readonly messages: {
        readonly incoming?: TypeDescriptor<TIncoming>
        readonly outgoing?: TypeDescriptor<TOutgoing>
    }
    readonly codec: SocketCodec<TIncoming, TOutgoing>
    readonly meta: SocketProfileMeta
}

export interface SocketConnectInput<TPath, TQuery, THeaders> {
    readonly path?: TPath
    readonly query?: TQuery
    readonly headers?: THeaders
    readonly context?: TransportRequestContext
}

export interface SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing> {
    readonly connectionId: ConnectionId
    readonly profile: SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>
    readonly url: string
    readonly headers: Record<string, string>
    readonly selectedAddress: TransportServerAddress
    readonly timeoutMs?: number
}

export interface SocketConnectionHandlers {
    onOpen(): void
    onMessage(raw: string): void
    onClose(reason?: string): void
    onError(error: unknown): void
}

export interface SocketTransportConnection {
    sendRaw(payload: string): void
    disconnect(reason?: string): void
}

export interface SocketTransport {
    connect<TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        connection: SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
        handlers: SocketConnectionHandlers,
    ): Promise<SocketTransportConnection>
}

export interface SocketConnectionMetric {
    readonly profileName: string
    readonly serverName: string
    readonly connectionId: ConnectionId
    readonly selectedAddressName: string
    readonly url: string
    readonly startedAt: TimestampMs
    readonly endedAt: TimestampMs
    readonly durationMs: number
    readonly success: boolean
    readonly disconnectReason?: string
    readonly inboundMessageCount: number
    readonly outboundMessageCount: number
}

export interface SocketMetricsRecorder {
    recordConnection(metric: SocketConnectionMetric): void
}

export type SocketEventType =
    | 'state-change'
    | 'connected'
    | 'disconnected'
    | 'message'
    | 'error'

export interface SocketStateChangeEvent {
    readonly type: 'state-change'
    readonly connectionId: ConnectionId
    readonly previousState: SocketConnectionState
    readonly nextState: SocketConnectionState
    readonly occurredAt: TimestampMs
}

export interface SocketConnectedEvent {
    readonly type: 'connected'
    readonly connectionId: ConnectionId
    readonly url: string
    readonly addressName: string
    readonly occurredAt: TimestampMs
}

export interface SocketDisconnectedEvent {
    readonly type: 'disconnected'
    readonly connectionId: ConnectionId
    readonly reason?: string
    readonly occurredAt: TimestampMs
}

export interface SocketErrorEvent {
    readonly type: 'error'
    readonly connectionId: ConnectionId
    readonly error: unknown
    readonly occurredAt: TimestampMs
}

export interface SocketMessageEvent<TIncoming = unknown> {
    readonly type: 'message'
    readonly connectionId: ConnectionId
    readonly message: TIncoming
    readonly occurredAt: TimestampMs
}

export type SocketEvent<TIncoming = unknown> =
    | SocketStateChangeEvent
    | SocketConnectedEvent
    | SocketDisconnectedEvent
    | SocketErrorEvent
    | SocketMessageEvent<TIncoming>

export type SocketEventListener<TIncoming = unknown> = (event: SocketEvent<TIncoming>) => void

export interface CreateSocketRuntimeInput {
    readonly logger: LoggerPort
    readonly transport: SocketTransport
    readonly servers?: readonly TransportServerDefinition[]
    readonly serverProvider?: () => readonly TransportServerDefinition[]
    readonly metricsRecorder?: SocketMetricsRecorder
}

export interface SocketRuntime {
    registerProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        profile: SocketConnectionProfile<TPath, TQuery, THeaders, TIncoming, TOutgoing>,
    ): void
    connect<TPath, TQuery, THeaders, TIncoming, TOutgoing>(
        profileName: string,
        input?: SocketConnectInput<TPath, TQuery, THeaders>,
    ): Promise<SocketResolvedConnection<TPath, TQuery, THeaders, TIncoming, TOutgoing>>
    send<TOutgoing>(profileName: string, message: TOutgoing): void
    disconnect(profileName: string, reason?: string): void
    getConnectionState(profileName: string): SocketConnectionState
    on<TIncoming>(profileName: string, eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void
    off<TIncoming>(profileName: string, eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void
    replaceServers(servers: readonly TransportServerDefinition[]): void
    getServerCatalog(): ServerCatalog
}

export interface SocketRuntimeFailure extends AppError {
    readonly details?: unknown
}

export interface SocketLifecycleReconnectPolicy {
    readonly attempts: number
    readonly delayMs: number
}

export interface SocketLifecycleControllerHandlers {
    connected(): void
    disconnected(reason?: string): void
    error(error: unknown): void
}

export interface SocketLifecycleController {
    attach(): void
    start(options?: {isReconnect?: boolean}): Promise<void>
    stop(reason?: string): void
    restart(reason?: string): Promise<void>
    getReconnectAttempt(): number
    resetReconnectAttempt(): void
    clearReconnectTimer(): void
    scheduleReconnect(reason?: string): void
}

export interface CreateSocketLifecycleControllerInput {
    connect(options?: {isReconnect?: boolean}): Promise<void>
    disconnect(reason?: string): void
    attachListeners(handlers: SocketLifecycleControllerHandlers): void
    resolveReconnectPolicy(): SocketLifecycleReconnectPolicy
    shouldReconnect(): boolean
    shouldReconnectOnConnectError?(error: unknown): boolean
    onConnectStarting?(input: {isReconnect: boolean}): void
    onConnectResolved?(input: {isReconnect: boolean}): void | Promise<void>
    onConnectFailed?(input: {isReconnect: boolean; error: unknown}): void
    onConnected?(): void
    onDisconnected?(reason?: string): void
    onError?(error: unknown): void
    onReconnectScheduled?(input: {reason?: string; attempt: number; delayMs: number}): void
    onReconnectGiveUp?(input: {reason?: string; attempt: number; attempts: number}): void
}
