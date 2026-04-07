import {AxiosHttpTransport, defineHttpEndpoint, HttpClient, InMemoryHttpMetricsRecorder, ServerResolver, typed} from '../src'

export async function testHttpRuntime() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationTest',
    retryCount: 1,
    retryInterval: 0,
    addresses: [{addressName: 'local', baseURL: 'http://localhost:6190', timeout: 1000}],
  })

  const transport = new AxiosHttpTransport()
  const metrics = new InMemoryHttpMetricsRecorder()
  const client = new HttpClient(serverResolver, transport, {unwrapEnvelope: true, metricsRecorder: metrics})

  const activateEndpoint = defineHttpEndpoint<{deviceId: string}, {verbose?: boolean}, {activeCode: string}, {deviceId: string; activated: boolean}>({
    name: 'test.http.activate',
    serverName: 'communicationTest',
    method: 'POST',
    pathTemplate: '/http/devices/{deviceId}/activate',
    request: {
      path: typed<{deviceId: string}>(),
      query: typed<{verbose?: boolean}>(),
      body: typed<{activeCode: string}>(),
    },
    response: typed<{deviceId: string; activated: boolean}>(),
  })

  const activateResult = await client.call(activateEndpoint, {
    path: {deviceId: 'D-2'},
    query: {verbose: true},
    body: {activeCode: 'ACT-2'},
  })

  if (!activateResult.activated || activateResult.deviceId !== 'D-2') {
    throw new Error(`激活结果异常: ${JSON.stringify(activateResult)}`)
  }

  const envelopeErrorEndpoint = defineHttpEndpoint<void, void, void, {value: string}>({
    name: 'test.http.envelopeError',
    serverName: 'communicationTest',
    method: 'GET',
    pathTemplate: '/http/envelope-error',
    response: typed<{value: string}>(),
  })

  let envelopeErrorCaught = false
  try {
    await client.call(envelopeErrorEndpoint, {})
  } catch {
    envelopeErrorCaught = true
  }
  if (!envelopeErrorCaught) {
    throw new Error('预期应捕获 business error，但未捕获')
  }

  const retryEndpoint = defineHttpEndpoint<void, void, void, {attempts: number}>({
    name: 'test.http.retry',
    serverName: 'communicationTest',
    method: 'GET',
    pathTemplate: '/http/retry-once',
    response: typed<{attempts: number}>(),
    meta: {retry: 1},
  })

  const retryResult = await client.call(retryEndpoint, {})
  if (retryResult.attempts < 2) {
    throw new Error(`retry 未生效: ${JSON.stringify(retryResult)}`)
  }

  const slowEndpoint = defineHttpEndpoint<void, {delayMs: number}, void, {delayMs: number}>({
    name: 'test.http.cancel',
    serverName: 'communicationTest',
    method: 'GET',
    pathTemplate: '/http/slow',
    request: {
      query: typed<{delayMs: number}>(),
    },
    response: typed<{delayMs: number}>(),
    meta: {timeoutMs: 5000},
  })

  const controller = new AbortController()
  const slowPromise = client.call(slowEndpoint, {
    query: {delayMs: 800},
    context: {signal: controller.signal},
  })
  setTimeout(() => controller.abort('cancel for test'), 50)

  let cancelled = false
  try {
    await slowPromise
  } catch {
    cancelled = true
  }
  if (!cancelled) {
    throw new Error('预期 slow request 被取消，但没有取消')
  }

  if (metrics.getCalls().length < 3) {
    throw new Error('metrics 记录数量不足')
  }

  return {name: 'testHttpRuntime', passed: true}
}
