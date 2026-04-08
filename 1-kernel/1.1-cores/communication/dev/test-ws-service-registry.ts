import {
  defineSocketProfile,
  defineSocketServiceModule,
  socketServiceRegistry,
  SocketRuntime,
  typed,
  type SocketFactory,
  type SocketLike,
} from '../src'

class DummySocket implements SocketLike {
  private readonly listeners: Record<string, Array<(...args: any[]) => void>> = {
    open: [],
    close: [],
    error: [],
    message: [],
  }

  constructor() {
    setTimeout(() => {
      this.listeners.open.forEach(listener => listener())
    }, 0)
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

class DummySocketFactory implements SocketFactory {
  create(): SocketLike {
    return new DummySocket()
  }
}

export async function runWsServiceRegistryDemo() {
  const runtime = new SocketRuntime({
    socketFactory: new DummySocketFactory(),
    servers: [
      {
        serverName: 'demoWs',
        addresses: [{addressName: 'local', baseURL: 'http://localhost:7001'}],
      },
    ],
  })

  const profile = defineSocketProfile<{deviceId: string}, Record<string, string>, {type: string}, {type: string}>({
    name: 'demo.ws.profile',
    serverName: 'demoWs',
    pathTemplate: '/ws/demo',
    handshake: {
      query: typed<{deviceId: string}>('WsDemoQuery'),
      headers: typed<Record<string, string>>('WsDemoHeaders'),
    },
    messages: {
      incoming: typed<{type: string}>('WsDemoIncoming'),
      outgoing: typed<{type: string}>('WsDemoOutgoing'),
    },
  })

  runtime.registerProfile({profile})

  const wsModule = defineSocketServiceModule('demo.ws', {
    connect: (deviceId: string) => runtime.connect('demo.ws.profile', {query: {deviceId}}),
    disconnect: () => runtime.disconnect('demo.ws.profile', 'demo done'),
  })

  socketServiceRegistry.clear()
  socketServiceRegistry.registerModule(wsModule.moduleName, wsModule.services)

  const services = socketServiceRegistry.getModule<typeof wsModule.services>('demo.ws')
  const result = await services.connect('DEVICE-1')
  services.disconnect()

  return {
    stateAfterDisconnect: runtime.getConnectionState('demo.ws.profile'),
    resolvedUrl: result.resolvedConnection.url,
  }
}
