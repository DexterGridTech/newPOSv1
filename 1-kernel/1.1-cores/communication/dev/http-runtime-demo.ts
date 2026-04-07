import {
  defineHttpEndpoint,
  HttpClient,
  InMemoryHttpMetricsRecorder,
  ServerResolver,
  typed,
  type HttpSuccessResponse,
  type HttpTransport,
  type HttpTransportRequest,
} from '../src'

interface DemoResponse {
  ok: true
  from: string
}

class FakeFailoverTransport implements HttpTransport {
  private count = 0

  async execute<TPath, TQuery, TBody, TResponse>(
    request: HttpTransportRequest<TPath, TQuery, TBody>,
  ): Promise<HttpSuccessResponse<TResponse>> {
    this.count += 1
    if (this.count === 1) {
      throw new Error(`network error from ${request.selectedAddress.addressName}`)
    }
    return {
      data: {
        ok: true,
        from: request.selectedAddress.addressName,
      } as TResponse,
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
}

export async function runHttpRuntimeDemo() {
  const endpoint = defineHttpEndpoint<void, {keyword?: string}, {value: string}, DemoResponse>({
    name: 'demo.failover',
    serverName: 'demoApi',
    method: 'POST',
    pathTemplate: '/api/demo/runtime',
    request: {
      query: typed<{keyword?: string}>('DemoQuery'),
      body: typed<{value: string}>('DemoBody'),
    },
    response: typed<DemoResponse>('DemoResponse'),
    meta: {
      timeoutMs: 3000,
      retry: 1,
    },
  })

  const metricsRecorder = new InMemoryHttpMetricsRecorder()
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'demoApi',
    retryCount: 1,
    retryInterval: 0,
    addresses: [
      {addressName: 'primary', baseURL: 'http://localhost:9001/service', timeout: 1000},
      {addressName: 'secondary', baseURL: 'http://localhost:9002/service', timeout: 1000},
    ],
  })

  const client = new HttpClient(serverResolver, new FakeFailoverTransport(), {
    unwrapEnvelope: false,
    metricsRecorder,
  })

  const abortController = new AbortController()
  const response = await client.call(endpoint, {
    query: {keyword: 'demo'},
    body: {value: 'payload'},
    context: {signal: abortController.signal},
  })

  return {
    response,
    metrics: metricsRecorder.getCalls(),
  }
}
