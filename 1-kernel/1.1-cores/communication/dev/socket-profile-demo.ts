import {BaseSocketClient, buildSocketUrl, defineSocketProfile, ServerResolver, typed} from '../src'

interface KernelSocketQuery {
  deviceId: string
  token: string
}

interface KernelIncoming {
  type: string
  data: unknown
}

interface KernelOutgoing {
  type: string
  data: unknown
}

export async function runSocketProfileDemo() {
  const profile = defineSocketProfile<KernelSocketQuery, Record<string, string>, KernelIncoming, KernelOutgoing>({
    name: 'terminal.kernelSocket',
    serverName: 'kernelWS',
    pathTemplate: '/ws/connect',
    handshake: {
      query: typed<KernelSocketQuery>('KernelSocketQuery'),
      headers: typed<Record<string, string>>('KernelSocketHeaders'),
    },
    messages: {
      incoming: typed<KernelIncoming>('KernelIncoming'),
      outgoing: typed<KernelOutgoing>('KernelOutgoing'),
    },
    meta: {
      auth: 'required',
      connectionTimeoutMs: 10000,
      heartbeatIntervalMs: 30000,
      heartbeatTimeoutMs: 60000,
      maxQueueSize: 100,
      tags: ['terminal', 'kernel-ws'],
    },
  })

  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'kernelWS',
    addresses: [{addressName: 'local-ws', baseURL: 'http://localhost:9999/kernel-server', timeout: 3000}],
  })

  const client = new BaseSocketClient(serverResolver)
  const resolved = await client.connect(profile, {
    query: {deviceId: 'D1001', token: 'TOKEN-001'},
    headers: {Authorization: 'Bearer TOKEN-001'},
  })

  return {
    profile,
    resolved,
    url: buildSocketUrl('http://localhost:9999/kernel-server', '/ws/connect', {deviceId: 'D1001', token: 'TOKEN-001'}),
  }
}
