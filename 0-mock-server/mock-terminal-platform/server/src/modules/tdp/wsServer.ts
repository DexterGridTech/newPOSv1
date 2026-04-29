import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Express } from 'express'
import { WebSocketServer } from 'ws'
import type WebSocket from 'ws'
import { appendAuditLog } from '../admin/audit.js'
import { createId, now } from '../../shared/utils.js'
import {
  acknowledgeSessionRevision,
  acknowledgeProjectionBatchForSession,
  connectSession,
  disconnectSession,
  getHighWatermarkForTerminal,
  getTerminalChangesSince,
  getTerminalSnapshotEnvelope,
  heartbeatSession,
  isTerminalCursorStale,
  updateSessionAppliedRevision,
  validateTerminalAccessToken,
} from './service.js'
import { upsertTerminalRuntimeFacts } from './groupService.js'
import { getOnlineSessionBySocket, registerOnlineSession, unregisterOnlineSession } from './wsSessionRegistry.js'
import { parseClientMessage, type TdpServerMessage } from './wsProtocol.js'
import {
  normalizeSubscription,
  readTerminalTopicPolicy,
  TDP_SNAPSHOT_CHUNK_CAPABILITY_V1,
  TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1,
} from './subscriptionPolicy.js'

const WS_PATH = '/api/v1/tdp/ws/connect'
const NODE_ID = 'mock-tdp-node-01'
const SNAPSHOT_CHUNK_SIZE = 50

const sendMessage = (socket: WebSocket, message: TdpServerMessage) => {
  if (socket.readyState !== socket.OPEN) return
  socket.send(JSON.stringify(message))
}

const chunk = <T>(items: readonly T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const sendChunkedSnapshot = (
  socket: WebSocket,
  input: {
    terminalId: string
    snapshot: readonly import('./wsProtocol.js').TdpProjectionEnvelope[]
    highWatermark: number
    subscriptionHash?: string
  },
) => {
  const snapshotId = createId('snapshot')
  const chunks = chunk(input.snapshot, SNAPSHOT_CHUNK_SIZE)
  sendMessage(socket, {
    type: 'SNAPSHOT_BEGIN',
    data: {
      terminalId: input.terminalId,
      snapshotId,
      totalChunks: chunks.length,
      totalItems: input.snapshot.length,
      highWatermark: input.highWatermark,
      subscriptionHash: input.subscriptionHash,
    },
  })
  chunks.forEach((items, chunkIndex) => {
    sendMessage(socket, {
      type: 'SNAPSHOT_CHUNK',
      data: {
        snapshotId,
        chunkIndex,
        items,
      },
    })
  })
  sendMessage(socket, {
    type: 'SNAPSHOT_END',
    data: {
      snapshotId,
    },
  })
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
  sandboxId: string
  terminalId: string
  appVersion: string
  lastCursor?: number
  protocolVersion?: string
  capabilities?: string[]
  subscribedTopics?: string[]
  requiredTopics?: string[]
  subscriptionHash?: string
  previousAcceptedSubscriptionHash?: string
  previousAcceptedTopics?: string[]
  subscriptionMode?: 'explicit'
  subscriptionVersion?: 1
  runtimeIdentity?: {
    localNodeId?: string
    displayIndex?: number
    displayCount?: number
    instanceMode?: 'MASTER' | 'SLAVE'
    displayMode?: 'PRIMARY' | 'SECONDARY'
  }
}) => {
  const url = new URL(req.url ?? '', 'http://127.0.0.1')
  const sandboxId = url.searchParams.get('sandboxId')
  const terminalId = url.searchParams.get('terminalId')
  const token = url.searchParams.get('token')

  if (!sandboxId || !terminalId || !token) {
    sendErrorAndClose(socket, 'UNAUTHORIZED', '缺少 sandboxId、terminalId 或 token')
    return
  }

  if (payload.sandboxId !== sandboxId) {
    sendErrorAndClose(socket, 'SANDBOX_ID_MISMATCH', '握手 sandboxId 与连接参数不一致')
    return
  }

  if (payload.terminalId !== terminalId) {
    sendErrorAndClose(socket, 'TERMINAL_ID_MISMATCH', '握手 terminalId 与连接参数不一致')
    return
  }

  const auth = validateTerminalAccessToken({ sandboxId, terminalId, token })
  if (!auth.valid) {
    sendErrorAndClose(socket, auth.code, auth.message)
    return
  }

  const protocolVersion = payload.protocolVersion?.trim() || '1.0'
  const appVersion = payload.appVersion?.trim()
  const topicPolicy = readTerminalTopicPolicy(sandboxId, terminalId)
  const subscription = normalizeSubscription({
    ...payload,
    allowedTopics: topicPolicy.allowedTopics,
  })
  const previousAcceptedSubscriptionHash = typeof payload.previousAcceptedSubscriptionHash === 'string'
    ? payload.previousAcceptedSubscriptionHash.trim()
    : ''
  const acceptedSubscriptionChanged = Boolean(
    Math.max(0, Number(payload.lastCursor ?? 0)) > 0
    && subscription.mode === 'explicit'
    && previousAcceptedSubscriptionHash
    && previousAcceptedSubscriptionHash !== subscription.hash,
  )
  const subscriptionFilter = {
    mode: subscription.mode,
    acceptedTopics: subscription.acceptedTopics,
  }
  if (!appVersion) {
    sendErrorAndClose(socket, 'INVALID_HANDSHAKE', '缺少 appVersion')
    return
  }

  const connection = connectSession({
    sandboxId,
    terminalId,
    clientVersion: appVersion,
    protocolVersion,
    localNodeId: payload.runtimeIdentity?.localNodeId,
    displayIndex: payload.runtimeIdentity?.displayIndex,
    displayCount: payload.runtimeIdentity?.displayCount,
    instanceMode: payload.runtimeIdentity?.instanceMode,
    displayMode: payload.runtimeIdentity?.displayMode,
    subscriptionMode: subscription.mode,
    subscriptionHash: subscription.hash,
    subscribedTopics: payload.subscribedTopics ?? [],
    acceptedTopics: subscription.acceptedTopics,
    rejectedTopics: subscription.rejectedTopics,
    requiredMissingTopics: subscription.requiredMissingTopics,
  })
  upsertTerminalRuntimeFacts({
    sandboxId,
    terminalId,
    appVersion,
    protocolVersion,
    capabilities: payload.capabilities ?? [],
  })
  const highWatermark = getHighWatermarkForTerminal(sandboxId, terminalId, subscriptionFilter)
  const lastCursor = Math.max(0, Number(payload.lastCursor ?? 0))
  const cursorStale = isTerminalCursorStale(sandboxId, terminalId, lastCursor, subscriptionFilter)
  const syncMode = cursorStale || acceptedSubscriptionChanged ? 'full' : 'incremental'

  registerOnlineSession({
    sessionId: connection.sessionId,
    terminalId,
    sandboxId,
    appVersion,
    protocolVersion,
    localNodeId: payload.runtimeIdentity?.localNodeId ?? null,
    displayIndex: payload.runtimeIdentity?.displayIndex ?? null,
    displayCount: payload.runtimeIdentity?.displayCount ?? null,
    instanceMode: payload.runtimeIdentity?.instanceMode ?? null,
    displayMode: payload.runtimeIdentity?.displayMode ?? null,
    lastCursor,
    lastDeliveredRevision: undefined,
    subscribedTopics: payload.subscribedTopics ?? [],
    subscriptionHash: subscription.hash,
    subscriptionMode: subscription.mode,
    acceptedTopics: subscription.acceptedTopics,
    rejectedTopics: subscription.rejectedTopics,
    requiredMissingTopics: subscription.requiredMissingTopics,
    capabilities: payload.capabilities ?? [],
    socket,
    connectedAt: now(),
  })

  appendAuditLog({
    domain: 'TDP',
    action: 'WS_CONNECT_SESSION',
    targetId: connection.sessionId,
    detail: {
      terminalId,
      protocolVersion,
      appVersion,
      lastCursor,
      syncMode,
      syncReason: cursorStale
        ? (lastCursor <= 0 ? 'initial_or_subscription_reset' : 'cursor_retention_expired')
        : acceptedSubscriptionChanged
          ? 'accepted_subscription_changed'
        : 'cursor_within_retention',
      runtimeIdentity: payload.runtimeIdentity,
      subscription,
      previousAcceptedSubscriptionHash: payload.previousAcceptedSubscriptionHash,
      previousAcceptedTopics: payload.previousAcceptedTopics,
      topicPolicy,
      clientSubscriptionHash: payload.subscriptionHash,
    },
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
      serverTime: new Date(now()).toISOString(),
      serverTimestamp: now(),
      subscription,
    },
  })

  if (subscription.mode === 'explicit' && subscription.requiredMissingTopics.length > 0) {
    sendErrorAndClose(socket, 'TDP_REQUIRED_TOPICS_REJECTED', '终端请求的必需 TDP topic 不在服务器允许范围内', {
      requiredMissingTopics: subscription.requiredMissingTopics,
      rejectedTopics: subscription.rejectedTopics,
      acceptedTopics: subscription.acceptedTopics,
      policySources: topicPolicy.policySources,
    })
    return
  }

  if (syncMode === 'full') {
    const snapshot = getTerminalSnapshotEnvelope(sandboxId, terminalId, subscriptionFilter)
    if ((payload.capabilities ?? []).includes(TDP_SNAPSHOT_CHUNK_CAPABILITY_V1)) {
      sendChunkedSnapshot(socket, {
        terminalId,
        snapshot,
        highWatermark,
        subscriptionHash: subscription.hash,
      })
      return
    }
    sendMessage(socket, {
      type: 'FULL_SNAPSHOT',
      data: {
        terminalId,
        snapshot,
        highWatermark,
      },
    })
    return
  }

  const changesPage = getTerminalChangesSince(sandboxId, terminalId, lastCursor, 100, subscriptionFilter)
  const changes = changesPage.changes
  sendMessage(socket, {
    type: 'CHANGESET',
    data: {
      terminalId,
      changes: changes.map(item => item.change),
      nextCursor: changes.length ? changes[changes.length - 1].cursor : lastCursor,
      hasMore: changesPage.hasMore,
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
    heartbeatSession({ sandboxId: onlineSession.sandboxId, sessionId: onlineSession.sessionId })
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
      updateSessionAppliedRevision({
        sandboxId: onlineSession.sandboxId,
        sessionId: onlineSession.sessionId,
        revision: message.data.lastAppliedCursor,
      })
    }
    heartbeatSession({ sandboxId: onlineSession.sandboxId, sessionId: onlineSession.sessionId })
    return
  }

  if (message.type === 'ACK') {
    onlineSession.lastAckedRevision = message.data.cursor
    acknowledgeSessionRevision({
      sandboxId: onlineSession.sandboxId,
      sessionId: onlineSession.sessionId,
      cursor: message.data.cursor,
      topic: message.data.topic,
      itemKey: message.data.itemKey ?? message.data.instanceId,
    })
    return
  }

  if (message.type === 'BATCH_ACK') {
    onlineSession.lastAckedRevision = message.data.nextCursor
    onlineSession.lastAppliedRevision = message.data.nextCursor
    acknowledgeProjectionBatchForSession({
      sandboxId: onlineSession.sandboxId,
      sessionId: onlineSession.sessionId,
      nextCursor: message.data.nextCursor,
      batchId: message.data.batchId,
      processingLagMs: message.data.processingLagMs,
      subscriptionHash: message.data.subscriptionHash,
    })
    return
  }
}

const handleSocketClose = (socket: WebSocket) => {
  const session = getOnlineSessionBySocket(socket)
  if (!session) return
  unregisterOnlineSession(session.sessionId)
  try {
    disconnectSession({ sandboxId: session.sandboxId, sessionId: session.sessionId })
    appendAuditLog({
      domain: 'TDP',
      action: 'WS_DISCONNECT_SESSION',
      targetId: session.sessionId,
      detail: { terminalId: session.terminalId, lastAckedRevision: session.lastAckedRevision, lastAppliedRevision: session.lastAppliedRevision },
      operator: 'terminal-client',
    })
  } catch (error) {
    if (error instanceof Error && error.message === '沙箱不存在') {
      return
    }
    throw error
  }
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
