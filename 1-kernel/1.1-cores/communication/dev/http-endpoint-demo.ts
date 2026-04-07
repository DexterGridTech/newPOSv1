import {AxiosHttpTransport, buildHttpUrl, defineHttpEndpoint, HttpClient, ServerResolver, typed} from '../src'

interface ActivateDeviceBody {
  activeCode: string
}

interface ActivateDeviceResponse {
  terminalId: string
  token: string
}

export async function runHttpEndpointDemo() {
  const endpoint = defineHttpEndpoint<{deviceId: string}, {verbose?: boolean}, ActivateDeviceBody, ActivateDeviceResponse>({
    name: 'terminal.activateDevice',
    serverName: 'kernelApi',
    method: 'POST',
    pathTemplate: '/api/device/{deviceId}/activate',
    request: {
      path: typed<{deviceId: string}>('ActivateDevicePath'),
      query: typed<{verbose?: boolean}>('ActivateDeviceQuery'),
      body: typed<ActivateDeviceBody>('ActivateDeviceBody'),
    },
    response: typed<ActivateDeviceResponse>('ActivateDeviceResponse'),
    meta: {
      auth: 'required',
      timeoutMs: 5000,
      retry: 1,
      tags: ['terminal', 'activation'],
    },
  })

  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'kernelApi',
    addresses: [{addressName: 'local', baseURL: 'http://localhost:9999/kernel-server', timeout: 3000}],
  })

  const url = buildHttpUrl('http://localhost:9999/kernel-server', endpoint.pathTemplate, {deviceId: 'D1001'}, {verbose: true})
  const client = new HttpClient(serverResolver, new AxiosHttpTransport(), {unwrapEnvelope: false})

  return {
    endpoint,
    url,
    previewCall: () =>
      client.call(endpoint, {
        path: {deviceId: 'D1001'},
        query: {verbose: true},
        body: {activeCode: 'ACT-001'},
      }),
  }
}
