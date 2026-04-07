import type {
  SocketBootstrapProvider,
  SocketConnectInput,
  SocketConnectionOrchestratorConnectInput,
  SocketConnectionOrchestratorOptions,
  SocketConnectionProfile,
  SocketDisconnectedEvent,
  SocketMessageEvent,
  SocketResolvedConnection,
  SocketSessionDescriptor,
} from '../../types'
import type {BaseSocketClient} from './BaseSocketClient'
import type {SocketEventListener} from './BaseEventManager'

export interface SocketConnectionOrchestratorConfig<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing> {
  socketClient: BaseSocketClient<TIncoming, TOutgoing>
  profile: SocketConnectionProfile<TQuery, THeaders, TIncoming, TOutgoing>
  bootstrapProvider: SocketBootstrapProvider<TBootstrapInput, TQuery, THeaders>
  options?: SocketConnectionOrchestratorOptions
}

export interface SocketConnectionOrchestratorResult<TQuery, THeaders> {
  descriptor: SocketSessionDescriptor<TQuery, THeaders>
  resolvedConnection: SocketResolvedConnection<TQuery, THeaders>
}

export class SocketConnectionOrchestrator<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing> {
  private lastDescriptor: SocketSessionDescriptor<TQuery, THeaders> | null = null
  private lastConnectInput: SocketConnectionOrchestratorConnectInput<TBootstrapInput> | null = null
  private refreshInFlight: Promise<SocketConnectionOrchestratorResult<TQuery, THeaders>> | null = null
  private readonly disconnectedListener: SocketEventListener<TIncoming>
  private readonly messageListener: SocketEventListener<TIncoming>

  constructor(
    private readonly config: SocketConnectionOrchestratorConfig<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing>,
  ) {
    this.disconnectedListener = event => {
      void this.handleDisconnected(event as SocketDisconnectedEvent)
    }
    this.messageListener = event => {
      void this.handleMessage(event as SocketMessageEvent<TIncoming>)
    }
    this.config.socketClient.on('DISCONNECTED', this.disconnectedListener)
    this.config.socketClient.on('MESSAGE', this.messageListener)
  }

  getLastDescriptor(): SocketSessionDescriptor<TQuery, THeaders> | null {
    return this.lastDescriptor
  }

  dispose(): void {
    this.config.socketClient.off('DISCONNECTED', this.disconnectedListener)
    this.config.socketClient.off('MESSAGE', this.messageListener)
  }

  async prepare(
    input: SocketConnectionOrchestratorConnectInput<TBootstrapInput>,
    options?: {retryAttempts?: number},
  ): Promise<SocketSessionDescriptor<TQuery, THeaders>> {
    const retryAttempts = options?.retryAttempts ?? this.config.options?.bootstrapRetryAttempts ?? 0
    let lastError: unknown

    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      try {
        const descriptor = await this.config.bootstrapProvider.provide({
          bootstrapInput: input.bootstrapInput,
          attempt,
        })
        this.lastDescriptor = descriptor
        return descriptor
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }

  async connect(
    input: SocketConnectionOrchestratorConnectInput<TBootstrapInput>,
  ): Promise<SocketConnectionOrchestratorResult<TQuery, THeaders>> {
    this.lastConnectInput = input
    return this.performConnect(input, this.config.options?.bootstrapRetryAttempts)
  }

  private async performConnect(
    input: SocketConnectionOrchestratorConnectInput<TBootstrapInput>,
    retryAttempts?: number,
  ): Promise<SocketConnectionOrchestratorResult<TQuery, THeaders>> {
    const descriptor = await this.prepare(input, {retryAttempts})
    const connectInput: SocketConnectInput<TQuery, THeaders> = {
      query: descriptor.query,
      headers: descriptor.headers,
      context: input.context,
    }
    const resolvedConnection = await this.config.socketClient.connect(this.config.profile, connectInput)

    return {
      descriptor,
      resolvedConnection,
    }
  }

  private shouldRefreshOnDisconnect(reason?: string): boolean {
    const reasons = this.config.options?.refreshOnDisconnectReasons ?? []
    if (reason && reasons.includes(reason)) {
      return true
    }
    return this.config.options?.refreshPredicate?.({
      reason,
      trigger: 'disconnect',
    }) ?? false
  }

  private shouldRefreshOnMessage(message: TIncoming): boolean {
    if (this.config.options?.refreshOnMessage?.(message)) {
      return true
    }
    return this.config.options?.refreshPredicate?.({
      message,
      trigger: 'message',
    }) ?? false
  }

  private async triggerRefresh(): Promise<void> {
    if (!this.lastConnectInput) {
      return
    }
    if (this.refreshInFlight) {
      return
    }

    this.refreshInFlight = this.performConnect(
      this.lastConnectInput,
      this.config.options?.refreshRetryAttempts,
    )

    try {
      await this.refreshInFlight
    } finally {
      this.refreshInFlight = null
    }
  }

  private async handleDisconnected(event: SocketDisconnectedEvent): Promise<void> {
    if (!this.lastConnectInput) {
      return
    }
    if (!this.shouldRefreshOnDisconnect(event.reason)) {
      return
    }
    await this.triggerRefresh()
  }

  private async handleMessage(event: SocketMessageEvent<TIncoming>): Promise<void> {
    if (!this.lastConnectInput) {
      return
    }
    if (!this.shouldRefreshOnMessage(event.message)) {
      return
    }
    await this.triggerRefresh()
  }
}
