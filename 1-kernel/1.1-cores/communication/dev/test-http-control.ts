import {AxiosHttpTransport, defineHttpEndpoint, HttpClient, ServerResolver, typed} from '../src'

export async function testHttpControl() {
  const serverResolver = new ServerResolver()
  serverResolver.registerServer({
    serverName: 'communicationControl',
    addresses: [{addressName: 'control-local', baseURL: 'http://localhost:6190', timeout: 2000}],
  })

  const queueClient = new HttpClient(serverResolver, new AxiosHttpTransport(), {
    unwrapEnvelope: true,
    executionPolicy: {
      maxConcurrent: 1,
    },
  })

  const queueEndpoint = defineHttpEndpoint<void, {delayMs: number}, void, {queueMaxObserved: number}>({
    name: 'test.http.queue',
    serverName: 'communicationControl',
    method: 'GET',
    pathTemplate: '/http/queue-check',
    request: {
      query: typed<{delayMs: number}>(),
    },
    response: typed<{queueMaxObserved: number}>(),
  })

  const [first, second] = await Promise.all([
    queueClient.call(queueEndpoint, {query: {delayMs: 80}}),
    queueClient.call(queueEndpoint, {query: {delayMs: 80}}),
  ])

  if (first.queueMaxObserved !== 1 || second.queueMaxObserved !== 1) {
    throw new Error(`并发队列未生效: ${JSON.stringify({first, second})}`)
  }

  const rateClient = new HttpClient(serverResolver, new AxiosHttpTransport(), {
    unwrapEnvelope: true,
    executionPolicy: {
      rateLimitWindowMs: 1000,
      rateLimitMaxRequests: 2,
    },
  })

  const rateEndpoint = defineHttpEndpoint<void, void, void, {count: number}>({
    name: 'test.http.rate',
    serverName: 'communicationControl',
    method: 'GET',
    pathTemplate: '/http/rate-limit-check',
    response: typed<{count: number}>(),
  })

  await rateClient.call(rateEndpoint, {})
  await rateClient.call(rateEndpoint, {})

  let rateLimited = false
  try {
    await rateClient.call(rateEndpoint, {})
  } catch {
    rateLimited = true
  }

  if (!rateLimited) {
    throw new Error('客户端侧 rate limit 未生效')
  }

  return {name: 'testHttpControl', passed: true}
}
