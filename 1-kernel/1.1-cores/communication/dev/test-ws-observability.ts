import {
  BaseSocketClient,
  defineSocketProfile,
  InMemorySocketMetricsRecorder,
  ServerResolver,
  typed,
  type SocketFactory,
  type SocketLike,
} from '../src'

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

export async function testWsObservability() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationWsObservable',
    addresses: [{addressName: 'local-ws', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const metricsRecorder = new InMemorySocketMetricsRecorder()
  const hookEvents: string[] = []
  const client = new BaseSocketClient<{type: string; payload?: unknown}, {type: string; payload?: unknown}>(
    serverResolver,
    new NodeWebSocketFactory(),
    {
      metricsRecorder,
      traceExtractor: context => ({
        traceId: context?.trace?.traceId,
        sessionId: context?.trace?.sessionId,
      }),
      hooks: {
        onBeforeConnect: ({resolvedConnection}) => {
          hookEvents.push(`before:${resolvedConnection.url}`)
        },
        onConnected: ({resolvedConnection}) => {
          hookEvents.push(`connected:${resolvedConnection.selectedAddressName}`)
        },
        onMessage: ({rawMessage}) => {
          hookEvents.push(`message:${rawMessage}`)
        },
        onDisconnected: ({reason}) => {
          hookEvents.push(`disconnected:${reason ?? ''}`)
        },
      },
    },
  )

  const profile = defineSocketProfile<{traceId: string; sessionId: string}, Record<string, string>, {type: string; payload?: unknown}, {type: string; payload?: unknown}>({
    name: 'test.ws.observable',
    serverName: 'communicationWsObservable',
    pathTemplate: '/ws/observable',
    handshake: {
      query: typed<{traceId: string; sessionId: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string; payload?: unknown}>(),
      outgoing: typed<{type: string; payload?: unknown}>(),
    },
    meta: {
      heartbeatTimeoutMs: 5000,
    },
  })

  const messages: string[] = []
  client.on('MESSAGE', event => messages.push(event.message.type))

  await client.connect(profile, {
    query: {
      traceId: 'trace-ob-1',
      sessionId: 'session-ob-1',
    },
    context: {
      trace: {
        traceId: 'trace-ob-1',
        sessionId: 'session-ob-1',
      },
    },
  })

  client.send({type: 'PING', payload: 'observe'})
  await new Promise(resolve => setTimeout(resolve, 120))
  client.disconnect('done')

  const metrics = metricsRecorder.getConnections()
  if (metrics.length !== 1) {
    throw new Error(`预期 1 条 WS metrics，实际为 ${metrics.length}`)
  }

  const metric = metrics[0]
  if (!metric.success || metric.trace?.traceId !== 'trace-ob-1' || metric.trace?.sessionId !== 'session-ob-1') {
    throw new Error(`WS metrics 异常: ${JSON.stringify(metric)}`)
  }

  if (!messages.includes('OBSERVED_READY') || !messages.includes('OBSERVED_ECHO')) {
    throw new Error(`WS 消息异常: ${JSON.stringify(messages)}`)
  }

  if (!hookEvents.some(item => item.startsWith('before:')) || !hookEvents.includes('connected:local-ws')) {
    throw new Error(`WS hooks 未触发完整: ${JSON.stringify(hookEvents)}`)
  }

  return {name: 'testWsObservability', passed: true}
}
