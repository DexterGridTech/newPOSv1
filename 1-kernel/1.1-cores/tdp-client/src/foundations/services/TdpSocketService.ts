import {
  JsonSocketCodec,
  SocketRuntime,
  type SocketEvent,
  type CommunicationServerConfig,
  type SocketLike,
} from '@impos2/kernel-core-communication'
import {tdpSocketProfile} from '../../supports'
import type {TdpClientMessage, TdpServerMessage} from '../../types'

// TDP WebSocket service 是 communication.SocketRuntime 的薄封装。
// 它只暴露 connect/send/disconnect/onEvent，不直接做状态落库。
export class TdpSocketService {
  private readonly runtime: SocketRuntime

  constructor(config?: {
    servers?: CommunicationServerConfig[]
    serverConfigProvider?: () => CommunicationServerConfig[]
    socketFactory?: {
      create(url: string, headers?: Record<string, string>): SocketLike
    }
  }) {
    this.runtime = new SocketRuntime({
      servers: config?.servers,
      serverConfigProvider: config?.serverConfigProvider,
      socketFactory: config?.socketFactory,
      codec: new JsonSocketCodec<TdpServerMessage, TdpClientMessage>(),
    })
    this.runtime.registerProfile({
      profile: tdpSocketProfile,
    })
  }

  onMessage(listener: (message: TdpServerMessage) => void) {
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'MESSAGE', event => {
      if (event.type === 'MESSAGE') {
        listener(event.message)
      }
    })
  }

  onEvent(listener: (event: SocketEvent<TdpServerMessage>) => void) {
    // 这里把同一个 profile 下的重要 runtime 事件统一透出给 actor 层。
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'STATE_CHANGE', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'CONNECTED', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'RECONNECTING', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'DISCONNECTED', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'ERROR', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'MESSAGE', listener)
    this.runtime.on<TdpServerMessage>(tdpSocketProfile.name, 'HEARTBEAT_TIMEOUT', listener)
  }

  async connect(input: {terminalId: string; token: string}) {
    // terminalId/token 来自 tcp-client 的控制面激活结果。
    return this.runtime.connect(tdpSocketProfile.name, {
      query: input,
    })
  }

  send(message: TdpClientMessage) {
    this.runtime.send(tdpSocketProfile.name, message)
  }

  disconnect(reason?: string) {
    this.runtime.disconnect(tdpSocketProfile.name, reason)
  }

  getState() {
    return this.runtime.getConnectionState(tdpSocketProfile.name)
  }
}

export const createTdpSocketService = (config?: ConstructorParameters<typeof TdpSocketService>[0]) =>
  new TdpSocketService(config)
