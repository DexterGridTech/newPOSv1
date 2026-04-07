import express from 'express'
import cors from 'cors'
import http from 'node:http'
import {WebSocketServer} from 'ws'

const PORT = Number(process.env.COMMUNICATION_TEST_PORT ?? 6190)
const app = express()
app.use(cors())
app.use(express.json())

let retryAttempts = 0
let interceptorChecks = 0
let queueActive = 0
let queueMaxObserved = 0
let rateLimitHits = 0
let recentRateRequests: number[] = []
let reconnectOpenCount = 0
const validSocketSessions = new Map<string, {deviceId: string; token: string}>()
const sessionConnectAttempts = new Map<string, number>()
const deviceSessionExpiryAttempts = new Map<string, number>()

function ok<T>(data: T) {
  return {code: 'SUCCESS', message: 'ok', data}
}

function businessError(message: string) {
  return {code: 'BUSINESS_ERROR', message, data: null}
}

app.get('/health', (_req, res) => {
  res.json(ok({service: 'communication-test', status: 'UP'}))
})

app.post('/http/echo', (req, res) => {
  res.json(ok({headers: req.headers, query: req.query, body: req.body}))
})

app.post('/http/devices/:deviceId/activate', (req, res) => {
  res.json(ok({deviceId: req.params.deviceId, query: req.query, body: req.body, activated: true}))
})

app.get('/http/envelope-success', (_req, res) => {
  res.json(ok({value: 'envelope-success'}))
})

app.get('/http/envelope-error', (_req, res) => {
  res.json(businessError('expected business error'))
})

app.get('/http/slow', async (req, res) => {
  const delayMs = Number(req.query.delayMs ?? 1000)
  await new Promise(resolve => setTimeout(resolve, delayMs))
  res.json(ok({delayMs}))
})

app.get('/http/retry-once', (_req, res) => {
  retryAttempts += 1
  if (retryAttempts === 1) {
    res.status(503).json({code: 'TEMP_UNAVAILABLE', message: 'retry me'})
    return
  }
  res.json(ok({attempts: retryAttempts}))
})

app.get('/http/interceptor-check', (req, res) => {
  interceptorChecks += 1
  const traceHeader = req.header('x-trace-id')
  const authHeader = req.header('authorization')
  if (!traceHeader || !authHeader) {
    res.status(400).json({code: 'MISSING_HEADERS', message: 'missing interceptor headers'})
    return
  }
  res.json(ok({interceptorChecks, traceHeader, authHeader}))
})

app.get('/http/queue-check', async (req, res) => {
  const delayMs = Number(req.query.delayMs ?? 100)
  queueActive += 1
  queueMaxObserved = Math.max(queueMaxObserved, queueActive)
  await new Promise(resolve => setTimeout(resolve, delayMs))
  queueActive -= 1
  res.json(ok({queueMaxObserved}))
})

app.get('/http/rate-limit-check', (_req, res) => {
  const now = Date.now()
  recentRateRequests = recentRateRequests.filter(item => now - item < 1000)
  recentRateRequests.push(now)
  if (recentRateRequests.length > 2) {
    rateLimitHits += 1
    res.status(429).json({code: 'RATE_LIMIT', message: 'too many requests', hits: rateLimitHits})
    return
  }
  res.json(ok({count: recentRateRequests.length, hits: rateLimitHits}))
})

app.post('/ws/bootstrap-session', (req, res) => {
  const deviceId = String(req.body?.deviceId ?? '')
  if (!deviceId) {
    res.status(400).json({code: 'MISSING_DEVICE_ID', message: 'deviceId is required'})
    return
  }

  const token = `session-${deviceId}-${Date.now()}`
  validSocketSessions.set(token, {deviceId, token})
  res.json(ok({deviceId, token, expiresInMs: 30000}))
})

app.post('/ws/bootstrap-expiring-session', (req, res) => {
  const deviceId = String(req.body?.deviceId ?? '')
  if (!deviceId) {
    res.status(400).json({code: 'MISSING_DEVICE_ID', message: 'deviceId is required'})
    return
  }

  const token = `expiring-${deviceId}-${Date.now()}`
  validSocketSessions.set(token, {deviceId, token})
  sessionConnectAttempts.set(token, 0)
  res.json(ok({deviceId, token, expiresInMs: 1000}))
})

const server = http.createServer(app)
const echoWss = new WebSocketServer({noServer: true})
const heartbeatWss = new WebSocketServer({noServer: true})
const reconnectWss = new WebSocketServer({noServer: true})
const stableWss = new WebSocketServer({noServer: true})
const sessionWss = new WebSocketServer({noServer: true})
const observableWss = new WebSocketServer({noServer: true})
const staleMessageWss = new WebSocketServer({noServer: true})

echoWss.on('connection', ws => {
  ws.send(JSON.stringify({type: 'WELCOME', payload: 'connected'}))
  ws.on('message', raw => {
    ws.send(JSON.stringify({type: 'ECHO', payload: raw.toString()}))
  })
})

heartbeatWss.on('connection', ws => {
  ws.send(JSON.stringify({type: 'WELCOME', payload: 'heartbeat-test'}))
})

reconnectWss.on('connection', ws => {
  reconnectOpenCount += 1
  ws.send(JSON.stringify({type: 'WELCOME', payload: `reconnect-${reconnectOpenCount}`}))
  if (reconnectOpenCount === 1) {
    setTimeout(() => {
      ws.close(4001, 'server forced reconnect')
    }, 50)
  }
})

stableWss.on('connection', ws => {
  ws.send(JSON.stringify({type: 'WELCOME', payload: 'stable'}))
})

sessionWss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
  const deviceId = url.searchParams.get('deviceId') ?? ''
  const token = url.searchParams.get('token') ?? ''
  const session = validSocketSessions.get(token)

  if (!session || session.deviceId !== deviceId) {
    ws.send(JSON.stringify({type: 'SESSION_REJECTED', reason: 'invalid session'}))
    ws.close(4401, 'invalid session')
    return
  }

  ws.send(JSON.stringify({type: 'SESSION_READY', payload: {deviceId, token}}))
  ws.on('message', raw => {
    ws.send(JSON.stringify({type: 'SESSION_ECHO', payload: raw.toString()}))
  })
})

observableWss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
  const traceId = url.searchParams.get('traceId') ?? ''
  const sessionId = url.searchParams.get('sessionId') ?? ''

  ws.send(
    JSON.stringify({
      type: 'OBSERVED_READY',
      payload: {
        traceId,
        sessionId,
      },
    }),
  )

  ws.on('message', raw => {
    ws.send(
      JSON.stringify({
        type: 'OBSERVED_ECHO',
        payload: raw.toString(),
      }),
    )
  })
})

staleMessageWss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
  const deviceId = url.searchParams.get('deviceId') ?? ''
  const token = url.searchParams.get('token') ?? ''
  const session = validSocketSessions.get(token)

  if (!session || session.deviceId !== deviceId) {
    ws.close(4401, 'invalid session')
    return
  }

  const deviceExpiryAttempt = (deviceSessionExpiryAttempts.get(`${deviceId}:message`) ?? 0) + 1
  deviceSessionExpiryAttempts.set(`${deviceId}:message`, deviceExpiryAttempt)

  if (deviceExpiryAttempt === 1) {
    ws.send(JSON.stringify({type: 'SESSION_STALE', payload: {deviceId, token}}))
    setTimeout(() => {
      ws.close(4401, 'session stale')
    }, 50)
    return
  }

  ws.send(JSON.stringify({type: 'SESSION_REFRESHED', payload: {deviceId, token}}))
  ws.on('message', raw => {
    ws.send(JSON.stringify({type: 'SESSION_ECHO', payload: raw.toString()}))
  })
})

const expiringSessionWss = new WebSocketServer({noServer: true})

expiringSessionWss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`)
  const deviceId = url.searchParams.get('deviceId') ?? ''
  const token = url.searchParams.get('token') ?? ''
  const session = validSocketSessions.get(token)

  if (!session || session.deviceId !== deviceId) {
    ws.close(4401, 'invalid session')
    return
  }

  const currentAttempt = (sessionConnectAttempts.get(token) ?? 0) + 1
  sessionConnectAttempts.set(token, currentAttempt)
  const deviceExpiryAttempt = (deviceSessionExpiryAttempts.get(deviceId) ?? 0) + 1
  deviceSessionExpiryAttempts.set(deviceId, deviceExpiryAttempt)

  if (deviceExpiryAttempt === 1) {
    ws.send(JSON.stringify({type: 'SESSION_EXPIRING', payload: {deviceId, token}}))
    setTimeout(() => {
      ws.close(4401, 'session expired')
    }, 50)
    return
  }

  ws.send(JSON.stringify({type: 'SESSION_REFRESHED', payload: {deviceId, token}}))
  ws.on('message', raw => {
    ws.send(JSON.stringify({type: 'SESSION_ECHO', payload: raw.toString()}))
  })
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  const routeMap = new Map([
    ['/ws/echo', echoWss],
    ['/ws/heartbeat-timeout', heartbeatWss],
    ['/ws/reconnect-once', reconnectWss],
    ['/ws/stable', stableWss],
    ['/ws/session-connect', sessionWss],
    ['/ws/observable', observableWss],
    ['/ws/session-stale-message', staleMessageWss],
    ['/ws/session-expiring-connect', expiringSessionWss],
  ])

  const target = routeMap.get(url.pathname)
  if (!target) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }

  target.handleUpgrade(request, socket, head, ws => {
    target.emit('connection', ws, request)
  })
})

server.listen(PORT, () => {
  console.log(`[communication-test] listening on http://localhost:${PORT}`)
})
