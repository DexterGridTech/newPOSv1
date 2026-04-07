import {
  AxiosHttpTransport,
  BaseSocketClient,
  defineHttpEndpoint,
  defineSocketProfile,
  HttpClient,
  ServerResolver,
  typed,
  type HttpEndpointDefinition,
  type SocketFactory,
  type SocketLike,
} from '../src'

interface BootstrapRequest {
  deviceId: string
}

interface BootstrapResponse {
  deviceId: string
  token: string
  expiresInMs: number
}

class NodeWebSocketAdapter implements SocketLike {
  private readonly socket: WebSocket
  private readonly listeners: Record<string, Set<(...args: any[]) => void>> = {
    open: new Set(),
    close: new Set(),
    error: new Set(),
    message: new Set(),
  }

  constructor(url: string) {
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', () => {
      this.listeners.open.forEach(listener => listener())
    })
    this.socket.addEventListener('close', event => {
      this.listeners.close.forEach(listener => listener({reason: event.reason}))
    })
    this.socket.addEventListener('error', event => {
      this.listeners.error.forEach(listener => listener(event))
    })
    this.socket.addEventListener('message', event => {
      this.listeners.message.forEach(listener => listener({data: String(event.data)}))
    })
  }

  send(data: string): void {
    this.socket.send(data)
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason)
  }

  addEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event].add(listener)
  }

  removeEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event].delete(listener)
  }
}

class NodeWebSocketFactory implements SocketFactory {
  create(url: string): SocketLike {
    return new NodeWebSocketAdapter(url)
  }
}

export async function testWsRefreshPolicy() {
  const {SocketConnectionOrchestrator} = await import('../src')

  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationHttp',
    addresses: [{addressName: 'local-http', baseURL: 'http://localhost:6190', timeout: 1000}],
  })
  serverResolver.registerServer({
    serverName: 'communicationWsRefreshPolicy',
    addresses: [{addressName: 'local-ws', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const bootstrapEndpoint: HttpEndpointDefinition<never, never, BootstrapRequest, BootstrapResponse> = defineHttpEndpoint({
    name: 'test.ws.refresh.policy.bootstrap',
    serverName: 'communicationHttp',
    method: 'POST',
    pathTemplate: '/ws/bootstrap-expiring-session',
    request: {
      body: typed<BootstrapRequest>(),
    },
    response: typed<BootstrapResponse>(),
  })

  const httpClient = new HttpClient(serverResolver, new AxiosHttpTransport(), {
    unwrapEnvelope: true,
  })

  const socketClient = new BaseSocketClient<{type: string; payload?: unknown}, {type: string; payload?: unknown}>(
    serverResolver,
    new NodeWebSocketFactory(),
  )

  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string; payload?: unknown}, {type: string; payload?: unknown}>({
    name: 'test.ws.refresh.policy.profile',
    serverName: 'communicationWsRefreshPolicy',
    pathTemplate: '/ws/session-stale-message',
    handshake: {
      query: typed<{deviceId: string; token: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string; payload?: unknown}>(),
      outgoing: typed<{type: string; payload?: unknown}>(),
    },
    meta: {
      reconnectAttempts: 0,
      heartbeatTimeoutMs: 5000,
    },
  })

  const messages: string[] = []
  socketClient.on('MESSAGE', event => messages.push(event.message.type))

  let bootstrapCalls = 0
  const orchestrator = new SocketConnectionOrchestrator({
    socketClient,
    profile,
    bootstrapProvider: {
      async provide({bootstrapInput}) {
        bootstrapCalls += 1
        const result = await httpClient.call(bootstrapEndpoint, {
          body: bootstrapInput,
        })
        return {
          query: {
            deviceId: result.deviceId,
            token: result.token,
          },
        }
      },
    },
    options: {
      refreshRetryAttempts: 1,
      refreshOnDisconnectReasons: ['session stale'],
      refreshOnMessage: message => message.type === 'SESSION_STALE',
      refreshPredicate: event => event.reason === 'session stale',
    },
  })

  await orchestrator.connect({
    bootstrapInput: {
      deviceId: 'DEVICE-REFRESH-POLICY-1',
    },
  })

  await new Promise(resolve => setTimeout(resolve, 240))
  socketClient.send({type: 'PING', payload: 'after-policy-refresh'})
  await new Promise(resolve => setTimeout(resolve, 120))
  socketClient.disconnect('done')

  if (bootstrapCalls < 2) {
    throw new Error(`预期 refresh policy 至少触发 2 次 bootstrap，但实际为 ${bootstrapCalls}`)
  }

  if (!messages.includes('SESSION_STALE') || !messages.includes('SESSION_REFRESHED') || !messages.includes('SESSION_ECHO')) {
    throw new Error(`refresh policy 消息异常: ${JSON.stringify(messages)}`)
  }

  return {name: 'testWsRefreshPolicy', passed: true}
}
