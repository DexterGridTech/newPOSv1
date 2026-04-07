import {BaseSocketClient, defineSocketProfile, ServerResolver, typed, type SocketFactory, type SocketLike} from '../src'

class TestSocket implements SocketLike {
  private readonly listeners: Record<string, Array<(...args: any[]) => void>> = {
    open: [],
    close: [],
    error: [],
    message: [],
  }

  constructor() {
    setTimeout(() => {
      this.listeners.open.forEach(listener => listener())
      setTimeout(() => {
        this.listeners.message.forEach(listener => listener({data: JSON.stringify({type: 'WELCOME'})}))
      }, 10)
    }, 10)
  }

  send(data: string): void {
    this.listeners.message.forEach(listener => listener({data: JSON.stringify({type: 'ECHO', payload: data})}))
  }

  close(_code?: number, reason?: string): void {
    this.listeners.close.forEach(listener => listener({reason}))
  }

  addEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event].push(listener)
  }

  removeEventListener(event: 'open' | 'close' | 'error' | 'message', listener: (...args: any[]) => void): void {
    this.listeners[event] = this.listeners[event].filter(item => item !== listener)
  }
}

class TestSocketFactory implements SocketFactory {
  create(): SocketLike {
    return new TestSocket()
  }
}

export async function testWsRuntime() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationWs',
    addresses: [{addressName: 'local-ws', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const client = new BaseSocketClient<{type: string}, {type: string; payload?: string}>(serverResolver, new TestSocketFactory())
  const events: string[] = []
  client.on('CONNECTED', () => events.push('CONNECTED'))
  client.on('MESSAGE', event => events.push(event.message.type))
  client.on('DISCONNECTED', () => events.push('DISCONNECTED'))

  client.send({type: 'PING', payload: 'before-open'})

  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string}, {type: string; payload?: string}>({
    name: 'test.ws.runtime',
    serverName: 'communicationWs',
    pathTemplate: '/ws/echo',
    handshake: {
      query: typed<{deviceId: string; token: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string}>(),
      outgoing: typed<{type: string; payload?: string}>(),
    },
    meta: {
      heartbeatTimeoutMs: 500,
      maxQueueSize: 10,
    },
  })

  await client.connect(profile, {
    query: {deviceId: 'W-2', token: 'TK-2'},
    headers: {Authorization: 'Bearer TK-2'},
  })

  client.send({type: 'PING', payload: 'after-open'})
  await new Promise(resolve => setTimeout(resolve, 80))
  client.disconnect('done')

  if (!events.includes('CONNECTED') || !events.includes('WELCOME') || !events.includes('ECHO')) {
    throw new Error(`WS 事件流异常: ${JSON.stringify(events)}`)
  }

  return {name: 'testWsRuntime', passed: true}
}
