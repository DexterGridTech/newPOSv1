import type {
  CommunicationRequestContext,
  SocketConnectionOrchestratorConnectInput,
  SocketConnectionProfile,
  SocketConnectionState,
  SocketEventType,
  SocketManagedConnection,
  SocketResolvedConnection,
  SocketRuntimeConfig,
  SocketRuntimeProfileRegistration,
} from '../../types'
import {CommunicationError, SocketRuntimeError} from '../../types'
import {ServerResolver} from '../shared/ServerResolver'
import {BaseSocketClient} from './BaseSocketClient'
import type {SocketEventListener} from './BaseEventManager'
import {SocketConnectionOrchestrator} from './SocketConnectionOrchestrator'

export interface SocketRuntimeConnectResult<TQuery, THeaders> {
  resolvedConnection: SocketResolvedConnection<TQuery, THeaders>
  descriptor?: unknown
}

export class SocketRuntime {
  readonly serverResolver: ServerResolver
  private readonly connections = new Map<string, SocketManagedConnection<any, any, any, any, any>>()

  constructor(private readonly config: SocketRuntimeConfig = {}) {
    this.serverResolver = new ServerResolver()
    this.refreshServers()
  }

  registerProfile<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing>(
    registration: SocketRuntimeProfileRegistration<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing>,
  ): void {
    this.refreshServers()
    const client = registration.client ?? new BaseSocketClient<TIncoming, TOutgoing>(
      this.serverResolver,
      this.config.socketFactory,
      {
        metricsRecorder: this.config.metricsRecorder,
        traceExtractor: this.config.traceExtractor,
        hooks: this.config.hooks,
        codec: this.config.codec as any,
      },
    )
    const orchestrator = registration.bootstrapProvider
      ? new SocketConnectionOrchestrator<TBootstrapInput, TQuery, THeaders, TIncoming, TOutgoing>({
        socketClient: client,
        profile: registration.profile,
        bootstrapProvider: registration.bootstrapProvider,
        options: registration.orchestratorOptions,
      })
      : undefined

    const existing = this.connections.get(registration.profile.name)
    existing?.orchestrator?.dispose()

    this.connections.set(registration.profile.name, {
      profile: registration.profile,
      client,
      bootstrapProvider: registration.bootstrapProvider,
      orchestrator,
    })
  }

  async connect<TQuery, THeaders>(
    profileName: string,
    input: {
      query?: TQuery
      headers?: THeaders
      bootstrapInput?: unknown
      context?: CommunicationRequestContext
    } = {},
  ): Promise<SocketRuntimeConnectResult<TQuery, THeaders>> {
    const connection = this.getConnection(profileName)
    this.refreshServers()

    try {
      if (connection.orchestrator) {
        const result = await connection.orchestrator.connect({
          bootstrapInput: input.bootstrapInput,
          context: input.context,
        } as SocketConnectionOrchestratorConnectInput<unknown>)
        return {
          resolvedConnection: result.resolvedConnection as SocketResolvedConnection<TQuery, THeaders>,
          descriptor: result.descriptor,
        }
      }

      const resolvedConnection = await connection.client.connect(
        connection.profile as SocketConnectionProfile<TQuery, THeaders, unknown, unknown>,
        {
          query: input.query,
          headers: input.headers,
          context: input.context,
        },
      )

      return {resolvedConnection}
    } catch (error) {
      throw new SocketRuntimeError(`Socket runtime 连接失败: ${profileName}`, {error})
    }
  }

  send<TOutgoing>(profileName: string, message: TOutgoing): void {
    this.getConnection(profileName).client.send(message)
  }

  disconnect(profileName: string, reason?: string): void {
    this.getConnection(profileName).client.disconnect(reason)
  }

  on<TIncoming>(profileName: string, eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    this.getConnection(profileName).client.on(eventType, listener as SocketEventListener<unknown>)
  }

  off<TIncoming>(profileName: string, eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    this.getConnection(profileName).client.off(eventType, listener as SocketEventListener<unknown>)
  }

  getConnectionState(profileName: string): SocketConnectionState {
    return this.getConnection(profileName).client.getState()
  }

  hasProfile(profileName: string): boolean {
    return this.connections.has(profileName)
  }

  clear(): void {
    this.connections.forEach(connection => {
      connection.orchestrator?.dispose()
      connection.client.disconnect('socket runtime cleared')
    })
    this.connections.clear()
  }

  private getConnection(profileName: string): SocketManagedConnection<any, any, any, any, any> {
    const connection = this.connections.get(profileName)
    if (!connection) {
      throw new CommunicationError('SOCKET_CONFIGURATION_ERROR', `Socket profile 未注册: ${profileName}`, {profileName})
    }
    return connection
  }

  private refreshServers(): void {
    const servers = this.config.servers ?? this.config.serverConfigProvider?.() ?? []
    this.serverResolver.clear()
    this.serverResolver.registerServers(servers)
  }
}
