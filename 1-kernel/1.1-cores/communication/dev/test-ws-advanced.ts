import {BaseSocketClient, defineSocketProfile, ServerResolver, typed, type SocketFactory, type SocketLike} from '../src'

class HeartbeatTimeoutSocket implements SocketLike {
  private readonly listeners: Record<string, Array<(...args: any[]) => void>> = {open: [], close: [], error: [], message: []}

  constructor() {
    setTimeout(() => {
      this.listeners.open.forEach(listener => listener())
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

class HeartbeatTimeoutFactory implements SocketFactory {
  create(): SocketLike {
    return new HeartbeatTimeoutSocket()
  }
}

export async function testWsAdvanced() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationWsAdvanced',
    addresses: [{addressName: 'ws-advanced', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const client = new BaseSocketClient<{type: string}, {type: string}>(serverResolver, new HeartbeatTimeoutFactory())
  const events: string[] = []
  client.on('HEARTBEAT_TIMEOUT', () => events.push('HEARTBEAT_TIMEOUT'))
  client.on('DISCONNECTED', () => events.push('DISCONNECTED'))

  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string}, {type: string}>({
    name: 'test.ws.heartbeat-timeout',
    serverName: 'communicationWsAdvanced',
    pathTemplate: '/ws/heartbeat-timeout',
    handshake: {
      query: typed<{deviceId: string; token: string}>(),
      headers: typed<Record<string, string>>(),
    },
    messages: {
      incoming: typed<{type: string}>(),
      outgoing: typed<{type: string}>(),
    },
    meta: {
      heartbeatTimeoutMs: 50,
    },
  })

  await client.connect(profile, {
    query: {deviceId: 'W-ADV', token: 'TK-ADV'},
    headers: {Authorization: 'Bearer TK-ADV'},
  })

  await new Promise(resolve => setTimeout(resolve, 120))

  if (!events.includes('HEARTBEAT_TIMEOUT')) {
    throw new Error(`未触发 heartbeat timeout: ${JSON.stringify(events)}`)
  }

  return {name: 'testWsAdvanced', passed: true}
}
