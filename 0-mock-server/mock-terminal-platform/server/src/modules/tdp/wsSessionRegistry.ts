import type WebSocket from 'ws'
import type { TdpProjectionEnvelope } from './wsProtocol.js'

export interface OnlineTdpSession {
  sessionId: string
  terminalId: string
  sandboxId: string
  appVersion: string
  protocolVersion: string
  localNodeId?: string | null
  displayIndex?: number | null
  displayCount?: number | null
  instanceMode?: 'MASTER' | 'SLAVE' | null
  displayMode?: 'PRIMARY' | 'SECONDARY' | null
  lastCursor: number
  lastDeliveredRevision?: number
  lastAckedRevision?: number
  lastAppliedRevision?: number
  subscribedTopics: string[]
  subscriptionHash?: string
  subscriptionMode: 'explicit' | 'legacy-all'
  acceptedTopics: string[]
  rejectedTopics: string[]
  requiredMissingTopics: string[]
  capabilities: string[]
  socket: WebSocket
  connectedAt: number
  batchQueue?: TdpProjectionEnvelope[]
  batchTimer?: ReturnType<typeof setTimeout>
  inflightBatchCount?: number
  deferredBatchFlush?: boolean
}

const sessionsById = new Map<string, OnlineTdpSession>()
let sessionIdBySocket = new WeakMap<WebSocket, string>()

export const registerOnlineSession = (session: OnlineTdpSession) => {
  sessionsById.set(session.sessionId, session)
  sessionIdBySocket.set(session.socket, session.sessionId)
}

export const getOnlineSessionById = (sessionId: string) => sessionsById.get(sessionId)

export const getOnlineSessionBySocket = (socket: WebSocket) => {
  const sessionId = sessionIdBySocket.get(socket)
  return sessionId ? sessionsById.get(sessionId) : undefined
}

export const unregisterOnlineSession = (sessionId: string) => {
  const session = sessionsById.get(sessionId)
  if (session?.batchTimer) {
    clearTimeout(session.batchTimer)
  }
  sessionsById.delete(sessionId)
}

export const resetOnlineSessions = () => {
  for (const session of sessionsById.values()) {
    if (session.batchTimer) {
      clearTimeout(session.batchTimer)
    }
  }
  sessionsById.clear()
  sessionIdBySocket = new WeakMap<WebSocket, string>()
}

export const listOnlineSessions = () => Array.from(sessionsById.values())

export const listOnlineSessionsByTerminalId = (sandboxId: string, terminalId: string) =>
  Array.from(sessionsById.values()).filter((item) => item.sandboxId === sandboxId && item.terminalId === terminalId)

export const listOnlineMasterSessionsByTerminalId = (sandboxId: string, terminalId: string) => {
  const sessions = listOnlineSessionsByTerminalId(sandboxId, terminalId)
  const identifiedSessions = sessions.filter((session) => session.instanceMode || session.displayMode)
  if (identifiedSessions.length === 0) {
    return sessions
  }
  const masterPrimarySessions = identifiedSessions.filter((session) =>
    session.instanceMode === 'MASTER' && session.displayMode === 'PRIMARY')
  if (masterPrimarySessions.length > 0) {
    return masterPrimarySessions
  }
  const masterSessions = identifiedSessions.filter((session) => session.instanceMode === 'MASTER')
  return masterSessions.length > 0 ? masterSessions : identifiedSessions
}

export const forceCloseOnlineSession = (input: {
  sessionId: string
  code?: number
  reason?: string
}) => {
  const session = sessionsById.get(input.sessionId)
  if (!session) {
    throw new Error('目标 session 当前不在线')
  }
  session.socket.close(input.code ?? 1012, input.reason ?? 'admin force close')
  return {
    sessionId: input.sessionId,
    code: input.code ?? 1012,
    reason: input.reason ?? 'admin force close',
  }
}
