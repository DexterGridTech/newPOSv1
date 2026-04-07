import {SocketConnectionError} from '../../types'
import type {
  SocketClientOptions,
  SocketConnectInput,
  SocketConnectionMetric,
  SocketConnectionProfile,
  SocketConnectionState,
  SocketEventType,
  SocketFactory,
  SocketLike,
  SocketResolvedConnection,
} from '../../types'
import {ServerResolver} from '../shared/ServerResolver'
import {buildSocketUrl} from './buildSocketUrl'
import {BaseEventManager, type SocketEventListener} from './BaseEventManager'
import {BaseHeartbeatManager} from './BaseHeartbeatManager'

export class BaseSocketClient<TIncoming = unknown, TOutgoing = unknown> {
  private state: SocketConnectionState = 'DISCONNECTED'
  private socket: SocketLike | null = null
  private resolvedConnection: SocketResolvedConnection<unknown, unknown> | null = null
  private readonly eventManager = new BaseEventManager<TIncoming>()
  private heartbeatManager: BaseHeartbeatManager | null = null
  private messageQueue: TOutgoing[] = []
  private isManualDisconnecting = false
  private activeProfile: SocketConnectionProfile<unknown, unknown, TIncoming, TOutgoing> | null = null
  private activeInput: SocketConnectInput<unknown, unknown> | null = null
  private reconnectAttempt = 0
  private activeMetric: SocketConnectionMetric | null = null

  constructor(
    private readonly serverResolver: ServerResolver,
    private readonly socketFactory?: SocketFactory,
    private readonly options: SocketClientOptions<TIncoming> = {},
  ) {}

  getState(): SocketConnectionState {
    return this.state
  }

  on(eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    this.eventManager.on(eventType, listener)
  }

  off(eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    this.eventManager.off(eventType, listener)
  }

  resolveConnection<TQuery, THeaders, TProfileIncoming, TProfileOutgoing>(
    profile: SocketConnectionProfile<TQuery, THeaders, TProfileIncoming, TProfileOutgoing>,
    input: SocketConnectInput<TQuery, THeaders>,
  ): SocketResolvedConnection<TQuery, THeaders> {
    const address = this.serverResolver.getFirstAddress(profile.serverName)
    return this.resolveConnectionForAddress(profile, input, address.baseURL, address.addressName, address.timeout)
  }

  private resolveConnectionForAddress<TQuery, THeaders, TProfileIncoming, TProfileOutgoing>(
    profile: SocketConnectionProfile<TQuery, THeaders, TProfileIncoming, TProfileOutgoing>,
    input: SocketConnectInput<TQuery, THeaders>,
    baseURL: string,
    addressName: string,
    timeout?: number,
  ): SocketResolvedConnection<TQuery, THeaders> {
    const query = {
      ...(input.query && typeof input.query === 'object' ? (input.query as Record<string, unknown>) : {}),
      ...normalizeTraceQuery(this.options.traceExtractor?.(input.context)),
    }
    const url = buildSocketUrl(baseURL, profile.pathTemplate, query)
    const headers = normalizeHeaders(input.headers)
    return {
      profile: profile as SocketConnectionProfile<TQuery, THeaders, unknown, unknown>,
      url,
      headers,
      selectedAddressName: addressName,
      timeoutMs: profile.meta.connectionTimeoutMs ?? timeout,
    }
  }

  async connect<TQuery, THeaders>(
    profile: SocketConnectionProfile<TQuery, THeaders, TIncoming, TOutgoing>,
    input: SocketConnectInput<TQuery, THeaders>,
  ): Promise<SocketResolvedConnection<TQuery, THeaders>> {
    this.activeProfile = profile as SocketConnectionProfile<unknown, unknown, TIncoming, TOutgoing>
    this.activeInput = input as SocketConnectInput<unknown, unknown>
    this.setState('CONNECTING')
    this.reconnectAttempt = 0
    return this.openAcrossAddresses(profile, input)
  }

  send(message: TOutgoing): void {
    if (!this.socket || this.state !== 'CONNECTED') {
      this.enqueueMessage(message)
      return
    }
    this.activeMetric && (this.activeMetric.outboundMessageCount += 1)
    this.socket.send(JSON.stringify(message))
  }

  disconnect(reason?: string): void {
    if (this.state === 'DISCONNECTED') {
      return
    }
    const resolvedConnection = this.resolvedConnection
    this.isManualDisconnecting = true
    this.setState('DISCONNECTING')
    this.heartbeatManager?.stop()
    this.socket?.close(1000, reason)
    this.socket = null
    this.setState('DISCONNECTED')
    this.finishMetric(true, reason)
    if (resolvedConnection) {
      this.options.hooks?.onDisconnected?.({
        resolvedConnection,
        reason,
      })
    }
    this.resolvedConnection = null
    this.eventManager.emit({type: 'DISCONNECTED', reason, timestamp: Date.now()})
  }

  getQueuedMessages(): TOutgoing[] {
    return [...this.messageQueue]
  }

  private attachSocket(socket: SocketLike): void {
    this.socket = socket

    const onOpen = () => {
      this.setState('CONNECTED')
      if (this.resolvedConnection) {
        this.options.hooks?.onConnected?.({resolvedConnection: this.resolvedConnection})
      }
      this.eventManager.emit({
        type: 'CONNECTED',
        url: this.resolvedConnection?.url ?? '',
        addressName: this.resolvedConnection?.selectedAddressName ?? '',
        timestamp: Date.now(),
      })
      this.flushQueue()
      this.heartbeatManager?.touch()
    }

    const onClose = (event: {reason?: string}) => {
      this.heartbeatManager?.stop()
      this.socket = null
      if (this.isManualDisconnecting) {
        this.isManualDisconnecting = false
        return
      }
      this.setState('DISCONNECTED')
      this.finishMetric(true, event.reason)
      if (this.resolvedConnection) {
        this.options.hooks?.onDisconnected?.({
          resolvedConnection: this.resolvedConnection,
          reason: event.reason,
        })
      }
      this.eventManager.emit({type: 'DISCONNECTED', reason: event.reason, timestamp: Date.now()})
      void this.tryReconnect(event.reason)
    }

    const onError = (event: unknown) => {
      this.finishMetric(false)
      this.eventManager.emit({type: 'ERROR', error: event, timestamp: Date.now()})
    }

    const onMessage = (event: {data: string}) => {
      this.heartbeatManager?.touch()
      this.activeMetric && (this.activeMetric.inboundMessageCount += 1)
      try {
        const message = JSON.parse(event.data) as TIncoming
        if (this.resolvedConnection) {
          this.options.hooks?.onMessage?.({
            resolvedConnection: this.resolvedConnection,
            rawMessage: event.data,
            parsedMessage: message,
          })
        }
        this.eventManager.emit({type: 'MESSAGE', message, timestamp: Date.now()})
      } catch (error) {
        this.eventManager.emit({type: 'ERROR', error, timestamp: Date.now()})
      }
    }

    socket.addEventListener('open', onOpen)
    socket.addEventListener('close', onClose)
    socket.addEventListener('error', onError)
    socket.addEventListener('message', onMessage)
  }

  private enqueueMessage(message: TOutgoing): void {
    this.messageQueue.push(message)
  }

  private flushQueue(): void {
    if (!this.socket) {
      return
    }
    while (this.messageQueue.length) {
      const nextMessage = this.messageQueue.shift()!
      this.activeMetric && (this.activeMetric.outboundMessageCount += 1)
      this.socket.send(JSON.stringify(nextMessage))
    }
  }

  private setState(nextState: SocketConnectionState): void {
    const previousState = this.state
    this.state = nextState
    this.eventManager.emit({
      type: 'STATE_CHANGE',
      previousState,
      nextState,
      timestamp: Date.now(),
    })
  }

  private async openAcrossAddresses<TQuery, THeaders>(
    profile: SocketConnectionProfile<TQuery, THeaders, TIncoming, TOutgoing>,
    input: SocketConnectInput<TQuery, THeaders>,
  ): Promise<SocketResolvedConnection<TQuery, THeaders>> {
    const serverConfig = this.serverResolver.resolve(profile.serverName)
    let lastError: unknown

    for (const address of serverConfig.addresses) {
      const resolved = this.resolveConnectionForAddress(
        profile,
        input,
        address.baseURL,
        address.addressName,
        address.timeout,
      )

      if (!this.socketFactory) {
        this.resolvedConnection = resolved as SocketResolvedConnection<unknown, unknown>
        this.startMetric(profile.name, profile.serverName, resolved, input)
        return resolved
      }

      try {
        this.resolvedConnection = resolved as SocketResolvedConnection<unknown, unknown>
        this.startMetric(profile.name, profile.serverName, resolved, input)
        this.options.hooks?.onBeforeConnect?.({resolvedConnection: this.resolvedConnection})
        const socket = this.socketFactory.create(resolved.url, resolved.headers)
        this.attachSocket(socket)
        this.heartbeatManager = new BaseHeartbeatManager(profile.meta.heartbeatTimeoutMs ?? 0, () => {
          this.eventManager.emit({type: 'HEARTBEAT_TIMEOUT', timestamp: Date.now()})
          this.disconnect('heartbeat timeout')
        })
        this.heartbeatManager.start()
        return resolved
      } catch (error) {
        this.finishMetric(false)
        lastError = error
      }
    }

    this.setState('DISCONNECTED')
    throw new SocketConnectionError('Socket 连接初始化失败', {lastError, profile, input})
  }

  private async tryReconnect(reason?: string): Promise<void> {
    if (!this.activeProfile || !this.activeInput) {
      return
    }
    const maxAttempts = this.activeProfile.meta.reconnectAttempts ?? 0
    if (this.reconnectAttempt >= maxAttempts) {
      return
    }
    this.reconnectAttempt += 1
    this.eventManager.emit({type: 'RECONNECTING', attempt: this.reconnectAttempt, timestamp: Date.now()})
    const intervalMs = this.activeProfile.meta.reconnectIntervalMs ?? 0
    if (intervalMs > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
    this.setState('CONNECTING')
    try {
      await this.openAcrossAddresses(this.activeProfile, this.activeInput)
    } catch (error) {
      this.eventManager.emit({type: 'ERROR', error: {reason, error}, timestamp: Date.now()})
    }
  }

  private startMetric(
    profileName: string,
    serverName: string,
    resolvedConnection: SocketResolvedConnection<unknown, unknown>,
    input: SocketConnectInput<unknown, unknown>,
  ): void {
    this.activeMetric = {
      profileName,
      serverName,
      selectedAddressName: resolvedConnection.selectedAddressName,
      url: resolvedConnection.url,
      startedAt: Date.now(),
      endedAt: 0,
      durationMs: 0,
      success: false,
      inboundMessageCount: 0,
      outboundMessageCount: 0,
      trace: this.options.traceExtractor?.(input.context),
    }
  }

  private finishMetric(success: boolean, disconnectReason?: string): void {
    if (!this.activeMetric) {
      return
    }
    const endedAt = Date.now()
    this.activeMetric.endedAt = endedAt
    this.activeMetric.durationMs = endedAt - this.activeMetric.startedAt
    this.activeMetric.success = success
    this.activeMetric.disconnectReason = disconnectReason
    this.options.metricsRecorder?.recordConnection({...this.activeMetric})
    this.activeMetric = null
  }
}

function normalizeHeaders<THeaders>(headers?: THeaders): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {}
  }
  return Object.entries(headers as Record<string, unknown>).reduce<Record<string, string>>((result, [key, value]) => {
    if (value === undefined || value === null) {
      return result
    }
    result[key] = String(value)
    return result
  }, {})
}

function normalizeTraceQuery(trace?: {traceId?: string; sessionId?: string}): Record<string, string> {
  const result: Record<string, string> = {}
  if (trace?.traceId) {
    result.traceId = trace.traceId
  }
  if (trace?.sessionId) {
    result.sessionId = trace.sessionId
  }
  return result
}
