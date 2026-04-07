import {AxiosHttpTransport, defineHttpEndpoint, HttpClient, InMemoryHttpMetricsRecorder, ServerResolver, typed} from '../src'

export async function testHttpAdvanced() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationAdvanced',
    retryCount: 0,
    retryInterval: 0,
    addresses: [{addressName: 'advanced-local', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const transport = new AxiosHttpTransport()
  transport.addRequestInterceptor(config => {
    config.headers = config.headers ?? {}
    config.headers['x-trace-id'] = 'trace-advanced'
    config.headers['authorization'] = 'Bearer advanced-token'
    return config
  })

  const client = new HttpClient(serverResolver, transport, {
    unwrapEnvelope: true,
    metricsRecorder: new InMemoryHttpMetricsRecorder(),
  })

  const interceptorEndpoint = defineHttpEndpoint<void, void, void, {traceHeader: string; authHeader: string}>({
    name: 'test.http.interceptor',
    serverName: 'communicationAdvanced',
    method: 'GET',
    pathTemplate: '/http/interceptor-check',
    response: typed<{traceHeader: string; authHeader: string}>(),
  })

  const interceptorResult = await client.call(interceptorEndpoint, {})
  if (interceptorResult.traceHeader !== 'trace-advanced' || interceptorResult.authHeader !== 'Bearer advanced-token') {
    throw new Error(`interceptor 注入失败: ${JSON.stringify(interceptorResult)}`)
  }

  return {name: 'testHttpAdvanced', passed: true}
}
