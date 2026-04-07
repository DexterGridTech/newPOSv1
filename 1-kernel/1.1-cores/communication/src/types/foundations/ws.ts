import type {CommunicationMeta, CommunicationRequestContext, TraceContext} from './shared'
import type {TypeDescriptor} from './http'

export type SocketConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTING'

export interface SocketConnectionMeta extends CommunicationMeta {
  connectionTimeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  maxQueueSize?: number
  reconnectAttempts?: number
  reconnectIntervalMs?: number
}

export interface SocketConnectionProfile<TQuery, THeaders, TIncoming, TOutgoing> {
  readonly protocol: 'ws'
  readonly name: string
  readonly serverName: string
  readonly pathTemplate: string
  readonly handshake: {
    readonly query?: TypeDescriptor<TQuery>
    readonly headers?: TypeDescriptor<THeaders>
  }
  readonly messages: {
    readonly incoming?: TypeDescriptor<TIncoming>
    readonly outgoing?: TypeDescriptor<TOutgoing>
  }
  readonly meta: SocketConnectionMeta
}

export interface SocketConnectInput<TQuery, THeaders> {
  query?: TQuery
  headers?: THeaders
  context?: CommunicationRequestContext
}

export interface SocketResolvedConnection<TQuery, THeaders> {
  profile: SocketConnectionProfile<TQuery, THeaders, unknown, unknown>
  url: string
  headers: Record<string, string>
  selectedAddressName: string
  timeoutMs?: number
}

export type SocketEventType =
  | 'STATE_CHANGE'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'MESSAGE'
  | 'HEARTBEAT_TIMEOUT'

export interface SocketStateChangeEvent {
  type: 'STATE_CHANGE'
  previousState: SocketConnectionState
  nextState: SocketConnectionState
  timestamp: number
}

export interface SocketConnectedEvent {
  type: 'CONNECTED'
  url: string
  addressName: string
  timestamp: number
}

export interface SocketReconnectingEvent {
  type: 'RECONNECTING'
  attempt: number
  timestamp: number
}

export interface SocketDisconnectedEvent {
  type: 'DISCONNECTED'
  reason?: string
  timestamp: number
}

export interface SocketErrorEvent {
  type: 'ERROR'
  error: unknown
  timestamp: number
}

export interface SocketMessageEvent<TIncoming = unknown> {
  type: 'MESSAGE'
  message: TIncoming
  timestamp: number
}

export interface SocketHeartbeatTimeoutEvent {
  type: 'HEARTBEAT_TIMEOUT'
  timestamp: number
}

export type SocketEvent<TIncoming = unknown> =
  | SocketStateChangeEvent
  | SocketConnectedEvent
  | SocketReconnectingEvent
  | SocketDisconnectedEvent
  | SocketErrorEvent
  | SocketMessageEvent<TIncoming>
  | SocketHeartbeatTimeoutEvent

export interface SocketLike {
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(event: 'open', listener: () => void): void
  addEventListener(event: 'close', listener: (event: {reason?: string}) => void): void
  addEventListener(event: 'error', listener: (event: unknown) => void): void
  addEventListener(event: 'message', listener: (event: {data: string}) => void): void
  removeEventListener(event: 'open', listener: () => void): void
  removeEventListener(event: 'close', listener: (event: {reason?: string}) => void): void
  removeEventListener(event: 'error', listener: (event: unknown) => void): void
  removeEventListener(event: 'message', listener: (event: {data: string}) => void): void
}

export interface SocketFactory {
  create(url: string, headers?: Record<string, string>): SocketLike
}

export interface SocketConnectionMetric {
  profileName: string
  serverName: string
  selectedAddressName: string
  url: string
  startedAt: number
  endedAt: number
  durationMs: number
  success: boolean
  disconnectReason?: string
  inboundMessageCount: number
  outboundMessageCount: number
  trace?: TraceContext
}

export interface SocketMetricsRecorder {
  recordConnection(metric: SocketConnectionMetric): void
}

export interface SocketHookContext<TIncoming = unknown> {
  resolvedConnection: SocketResolvedConnection<unknown, unknown>
  rawMessage?: string
  parsedMessage?: TIncoming
  reason?: string
}

export interface SocketClientHooks<TIncoming = unknown> {
  onBeforeConnect?(context: SocketHookContext<TIncoming>): void
  onConnected?(context: SocketHookContext<TIncoming>): void
  onMessage?(context: SocketHookContext<TIncoming>): void
  onDisconnected?(context: SocketHookContext<TIncoming>): void
}

export interface SocketClientOptions<TIncoming = unknown> {
  metricsRecorder?: SocketMetricsRecorder
  traceExtractor?: (context?: CommunicationRequestContext) => TraceContext | undefined
  hooks?: SocketClientHooks<TIncoming>
}

export interface SocketSessionDescriptor<TQuery = Record<string, unknown>, THeaders = Record<string, string>> {
  query?: TQuery
  headers?: THeaders
  meta?: Record<string, unknown>
}

export interface SocketBootstrapContext<TBootstrapInput = unknown> {
  bootstrapInput: TBootstrapInput
  attempt: number
}

export interface SocketBootstrapProvider<TBootstrapInput, TQuery, THeaders> {
  provide(context: SocketBootstrapContext<TBootstrapInput>): Promise<SocketSessionDescriptor<TQuery, THeaders>>
}

export interface SocketConnectionOrchestratorConnectInput<TBootstrapInput> {
  bootstrapInput: TBootstrapInput
  context?: CommunicationRequestContext
}

export interface SocketConnectionOrchestratorOptions {
  bootstrapRetryAttempts?: number
  refreshRetryAttempts?: number
  refreshOnDisconnectReasons?: string[]
  refreshOnMessage?: (message: any) => boolean
  refreshPredicate?: (event: {reason?: string; message?: any; trigger: 'disconnect' | 'message'}) => boolean
}
