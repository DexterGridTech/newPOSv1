import {BaseSocketClient, defineSocketProfile, ServerResolver, typed, type SocketFactory, type SocketLike} from '../src'

class ReconnectSocket implements SocketLike {
  private readonly listeners: Record<string, Array<(...args: any[]) => void>> = {open: [], close: [], error: [], message: []}
  private closedOnce = false

  constructor(private readonly mode: 'reconnect' | 'stable') {
    setTimeout(() => {
      this.listeners.open.forEach(listener => listener())
      this.listeners.message.forEach(listener => listener({data: JSON.stringify({type: 'WELCOME', payload: this.mode})}))
      if (this.mode === 'reconnect' && !this.closedOnce) {
        this.closedOnce = true
        setTimeout(() => {
          this.listeners.close.forEach(listener => listener({reason: 'server forced reconnect'}))
        }, 20)
      }
    }, 10)
  }

  send(_data: string): void {}
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

class ReconnectFailoverFactory implements SocketFactory {
  private createCount = 0

  create(url: string): SocketLike {
    this.createCount += 1
    if (url.includes('reconnect-host')) {
      return new ReconnectSocket(this.createCount === 1 ? 'reconnect' : 'stable')
    }
    if (url.includes('stable-host')) {
      return new ReconnectSocket('stable')
    }
    throw new Error(`unsupported url: ${url}`)
  }
}

export async function testWsReconnectFailover() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationWsReconnect',
    addresses: [
      {addressName: 'reconnect-path', baseURL: 'http://reconnect-host:6190', timeout: 1000},
      {addressName: 'stable-path', baseURL: 'http://stable-host:6190', timeout: 1000},
    ],
  })

  const client = new BaseSocketClient<{type: string; payload: string}, {type: string}>(serverResolver, new ReconnectFailoverFactory())
  const events: string[] = []
  client.on('CONNECTED', event => events.push(`CONNECTED:${event.addressName}`))
  client.on('DISCONNECTED', event => events.push(`DISCONNECTED:${event.reason ?? ''}`))
  client.on('MESSAGE', event => events.push(`MESSAGE:${event.message.payload}`))
  client.on('RECONNECTING', () => events.push('RECONNECTING'))

  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string; payload: string}, {type: string}>({
    name: 'test.ws.reconnectFailover',
    serverName: 'communicationWsReconnect',
    pathTemplate: '/ws/reconnect-once',
    handshake: {
      query: typed<{deviceId: string; token: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string; payload: string}>(),
      outgoing: typed<{type: string}>(),
    },
    meta: {
      heartbeatTimeoutMs: 200,
      reconnectAttempts: 1,
      reconnectIntervalMs: 10,
    },
  })

  await client.connect(profile, {
    query: {deviceId: 'W-R', token: 'TK-R'},
    headers: {Authorization: 'Bearer TK-R'},
  })

  await new Promise(resolve => setTimeout(resolve, 120))

  const messageEvents = events.filter(item => item.startsWith('MESSAGE:'))
  if (messageEvents.length < 2) {
    throw new Error(`预期至少收到 2 次消息以验证重连，但实际为: ${JSON.stringify(events)}`)
  }
  if (!events.includes('RECONNECTING')) {
    throw new Error(`预期触发 RECONNECTING 事件，但没有触发: ${JSON.stringify(events)}`)
  }

  return {name: 'testWsReconnectFailover', passed: true}
}
