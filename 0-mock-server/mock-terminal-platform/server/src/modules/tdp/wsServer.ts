import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Express } from 'express'
import { WebSocketServer } from 'ws'
import type WebSocket from 'ws'
import { appendAuditLog } from '../admin/audit.js'
import { createId, now } from '../../shared/utils.js'
import { getCurrentSandboxId } from '../sandbox/service.js'
import {
  acknowledgeSessionRevision,
  connectSession,
  disconnectSession,
  getHighWatermarkForTerminal,
  getTerminalChangesSince,
  getTerminalSnapshotEnvelope,
  heartbeatSession,
  updateSessionAppliedRevision,
  validateTerminalAccessToken,
} from './service.js'
import { getOnlineSessionBySocket, registerOnlineSession, unregisterOnlineSession } from './wsSessionRegistry.js'
import { parseClientMessage, type TdpServerMessage } from './wsProtocol.js'

const WS_PATH = '/api/v1/tdp/ws/connect'
const NODE_ID = 'mock-tdp-node-01'

const sendMessage = (socket: WebSocket, message: TdpServerMessage) => {
  if (socket.readyState !== socket.OPEN) return
  socket.send(JSON.stringify(message))
}

const sendErrorAndClose = (socket: WebSocket, code: string, message: string, details?: unknown) => {
  sendMessage(socket, {
    type: 'ERROR',
    error: {
      code,
      message,
      details,
    },
  })
  socket.close(1008, message)
}

const handleHandshake = (socket: WebSocket, req: IncomingMessage, payload: {
  terminalId: string
  appVersion: string
  lastCursor?: number
  protocolVersion?: string
  capabilities?: string[]
  subscribedTopics?: string[]
}) => {
  const url = new URL(req.url ?? '', 'http://127.0.0.1')
  const terminalId = url.searchParams.get('terminalId')
  const token = url.searchParams.get('token')

  if (!terminalId || !token) {
    sendErrorAndClose(socket, 'UNAUTHORIZED', '缺少 terminalId 或 token')
    return
  }

  if (payload.terminalId !== terminalId) {
    sendErrorAndClose(socket, 'TERMINAL_ID_MISMATCH', '握手 terminalId 与连接参数不一致')
    return
  }

  const auth = validateTerminalAccessToken({ terminalId, token })
  if (!auth.valid) {
    sendErrorAndClose(socket, auth.code, auth.message)
    return
  }

  const protocolVersion = payload.protocolVersion?.trim() || '1.0'
  const appVersion = payload.appVersion?.trim()
  if (!appVersion) {
    sendErrorAndClose(socket, 'INVALID_HANDSHAKE', '缺少 appVersion')
    return
  }

  const sandboxId = getCurrentSandboxId()
  const connection = connectSession({
    terminalId,
    clientVersion: appVersion,
    protocolVersion,
  })
  const highWatermark = getHighWatermarkForTerminal(terminalId)
  const lastCursor = Math.max(0, Number(payload.lastCursor ?? 0))
  const syncMode = lastCursor === 0 || lastCursor < Math.max(0, highWatermark - 1000) ? 'full' : 'incremental'

  registerOnlineSession({
    sessionId: connection.sessionId,
    terminalId,
    sandboxId,
    appVersion,
    protocolVersion,
    lastCursor,
    lastDeliveredRevision: undefined,
    subscribedTopics: payload.subscribedTopics ?? [],
    capabilities: payload.capabilities ?? [],
    socket,
    connectedAt: now(),
  })

  appendAuditLog({
    domain: 'TDP',
    action: 'WS_CONNECT_SESSION',
    targetId: connection.sessionId,
    detail: { terminalId, protocolVersion, appVersion, lastCursor, syncMode },
    operator: 'terminal-client',
  })

  sendMessage(socket, {
    type: 'SESSION_READY',
    data: {
      sessionId: connection.sessionId,
      nodeId: NODE_ID,
      nodeState: 'healthy',
      highWatermark,
      syncMode,
      alternativeEndpoints: [],
    },
  })

  if (syncMode === 'full') {
    sendMessage(socket, {
      type: 'FULL_SNAPSHOT',
      data: {
        terminalId,
        snapshot: getTerminalSnapshotEnvelope(terminalId),
        highWatermark,
      },
    })
    return
  }

  const changes = getTerminalChangesSince(terminalId, lastCursor)
  sendMessage(socket, {
    type: 'CHANGESET',
    data: {
      terminalId,
      changes: changes.map(item => item.change),
      nextCursor: changes.length ? changes[changes.length - 1].cursor : lastCursor,
      hasMore: false,
      highWatermark,
    },
  })
}

const handleClientMessage = (socket: WebSocket, req: IncomingMessage, raw: string) => {
  let message: ReturnType<typeof parseClientMessage>
  try {
    message = parseClientMessage(raw)
  } catch (error) {
    sendErrorAndClose(socket, 'INVALID_MESSAGE', error instanceof Error ? error.message : '消息格式非法')
    return
  }

  if (message.type === 'HANDSHAKE') {
    if (getOnlineSessionBySocket(socket)) {
      sendErrorAndClose(socket, 'DUPLICATE_HANDSHAKE', '会话已完成握手')
      return
    }
    handleHandshake(socket, req, message.data)
    return
  }

  const onlineSession = getOnlineSessionBySocket(socket)
  if (!onlineSession) {
    sendErrorAndClose(socket, 'HANDSHAKE_REQUIRED', '请先完成 HANDSHAKE')
    return
  }

  if (message.type === 'PING') {
    heartbeatSession(onlineSession.sessionId)
    sendMessage(socket, {
      type: 'PONG',
      data: {
        timestamp: now(),
      },
    })
    return
  }

  if (message.type === 'STATE_REPORT') {
    if (typeof message.data.lastAppliedCursor === 'number') {
      onlineSession.lastAppliedRevision = message.data.lastAppliedCursor
      updateSessionAppliedRevision(onlineSession.sessionId, message.data.lastAppliedCursor)
    }
    heartbeatSession(onlineSession.sessionId)
    return
  }

  if (message.type === 'ACK') {
    onlineSession.lastAckedRevision = message.data.cursor
    acknowledgeSessionRevision({
      sessionId: onlineSession.sessionId,
      cursor: message.data.cursor,
      topic: message.data.topic,
      itemKey: message.data.instanceId ?? message.data.itemKey,
    })
    return
  }
}

const handleSocketClose = (socket: WebSocket) => {
  const session = getOnlineSessionBySocket(socket)
  if (!session) return
  disconnectSession(session.sessionId)
  appendAuditLog({
    domain: 'TDP',
    action: 'WS_DISCONNECT_SESSION',
    targetId: session.sessionId,
    detail: { terminalId: session.terminalId, lastAckedRevision: session.lastAckedRevision, lastAppliedRevision: session.lastAppliedRevision },
    operator: 'terminal-client',
  })
  unregisterOnlineSession(session.sessionId)
}

export const createHttpAndWsServer = (app: Express) => {
  const server = createServer(app)
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head) => {
    const url = new URL(req.url ?? '', 'http://127.0.0.1')
    if (url.pathname !== WS_PATH) {
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })

  wss.on('connection', (socket, req) => {
    socket.on('message', (data) => {
      handleClientMessage(socket, req, data.toString())
    })
    socket.on('close', () => {
      handleSocketClose(socket)
    })
    socket.on('error', () => {
      handleSocketClose(socket)
    })
  })

  return server
}
