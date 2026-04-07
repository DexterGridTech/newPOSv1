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

export async function testWsSessionRefresh() {
  const {SocketConnectionOrchestrator} = await import('../src')

  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationHttp',
    addresses: [{addressName: 'local-http', baseURL: 'http://localhost:6190', timeout: 1000}],
  })
  serverResolver.registerServer({
    serverName: 'communicationWsSessionRefresh',
    addresses: [{addressName: 'local-ws', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const bootstrapEndpoint: HttpEndpointDefinition<never, never, BootstrapRequest, BootstrapResponse> = defineHttpEndpoint({
    name: 'test.ws.session.refresh.bootstrap',
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
    name: 'test.ws.session.refresh.profile',
    serverName: 'communicationWsSessionRefresh',
    pathTemplate: '/ws/session-expiring-connect',
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

  const events: string[] = []
  socketClient.on('CONNECTED', () => events.push('CONNECTED'))
  socketClient.on('MESSAGE', event => events.push(event.message.type))
  socketClient.on('DISCONNECTED', event => events.push(`DISCONNECTED:${event.reason ?? ''}`))

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
          headers: {
            Authorization: `Bearer ${result.token}`,
          },
          meta: {
            expiresInMs: result.expiresInMs,
          },
        }
      },
    },
    options: {
      refreshOnDisconnectReasons: ['session expired'],
      refreshRetryAttempts: 1,
    },
  })

  await orchestrator.connect({
    bootstrapInput: {
      deviceId: 'DEVICE-SESSION-REFRESH-1',
    },
  })

  await new Promise(resolve => setTimeout(resolve, 240))
  socketClient.send({type: 'PING', payload: 'after-refresh'})
  await new Promise(resolve => setTimeout(resolve, 120))
  socketClient.disconnect('done')

  if (bootstrapCalls < 2) {
    throw new Error(`预期至少 bootstrap 2 次，但实际为 ${bootstrapCalls}`)
  }

  if (!events.includes('SESSION_EXPIRING') || !events.includes('SESSION_REFRESHED') || !events.includes('SESSION_ECHO')) {
    throw new Error(`session refresh 事件异常: ${JSON.stringify(events)}`)
  }

  return {name: 'testWsSessionRefresh', passed: true}
}
