import {BaseSocketClient, defineSocketProfile, ServerResolver, typed, type SocketFactory, type SocketLike} from '../src'

class FakeSocket implements SocketLike {
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
        this.listeners.message.forEach(listener => listener({data: JSON.stringify({type: 'WELCOME', payload: 'ok'})}))
      }, 10)
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

class FakeSocketFactory implements SocketFactory {
  create(_url: string, _headers?: Record<string, string>): SocketLike {
    return new FakeSocket()
  }
}

export async function runSocketRuntimeDemo() {
  const profile = defineSocketProfile<{deviceId: string; token: string}, Record<string, string>, {type: string; payload: string}, {type: string; payload: string}>({
    name: 'runtime.socket',
    serverName: 'runtimeWs',
    pathTemplate: '/ws/runtime',
    handshake: {
      query: typed<{deviceId: string; token: string}>('RuntimeSocketQuery'),
      headers: typed<Record<string, string>>('RuntimeSocketHeaders'),
    },
    messages: {
      incoming: typed<{type: string; payload: string}>('RuntimeIncoming'),
      outgoing: typed<{type: string; payload: string}>('RuntimeOutgoing'),
    },
    meta: {
      connectionTimeoutMs: 5000,
      heartbeatTimeoutMs: 2000,
      maxQueueSize: 10,
    },
  })

  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'runtimeWs',
    addresses: [{addressName: 'ws-local', baseURL: 'http://localhost:9999/kernel-server', timeout: 3000}],
  })

  const client = new BaseSocketClient<{type: string; payload: string}, {type: string; payload: string}>(
    serverResolver,
    new FakeSocketFactory(),
  )

  const events: string[] = []
  client.on('STATE_CHANGE', event => events.push(`state:${event.previousState}->${event.nextState}`))
  client.on('CONNECTED', event => events.push(`connected:${event.addressName}`))
  client.on('MESSAGE', event => events.push(`message:${event.message.type}`))
  client.on('DISCONNECTED', event => events.push(`disconnected:${event.reason ?? ''}`))

  client.send({type: 'PING', payload: 'queued-before-connect'})

  const resolved = await client.connect(profile, {
    query: {deviceId: 'D2001', token: 'TOKEN-2001'},
    headers: {Authorization: 'Bearer TOKEN-2001'},
  })

  await new Promise(resolve => setTimeout(resolve, 50))
  client.disconnect('demo done')

  return {
    resolved,
    events,
    queuedMessagesAfterConnect: client.getQueuedMessages(),
  }
}
