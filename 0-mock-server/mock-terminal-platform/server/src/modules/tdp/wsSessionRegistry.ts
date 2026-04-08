import type WebSocket from 'ws'
import type { TdpProjectionEnvelope } from './wsProtocol.js'

export interface OnlineTdpSession {
  sessionId: string
  terminalId: string
  sandboxId: string
  appVersion: string
  protocolVersion: string
  lastCursor: number
  lastDeliveredRevision?: number
  lastAckedRevision?: number
  lastAppliedRevision?: number
  subscribedTopics: string[]
  capabilities: string[]
  socket: WebSocket
  connectedAt: number
  batchQueue?: TdpProjectionEnvelope[]
  batchTimer?: ReturnType<typeof setTimeout>
}

const sessionsById = new Map<string, OnlineTdpSession>()
const sessionIdBySocket = new WeakMap<WebSocket, string>()

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

export const listOnlineSessions = () => Array.from(sessionsById.values())

export const listOnlineSessionsByTerminalId = (terminalId: string) =>
  Array.from(sessionsById.values()).filter((item) => item.terminalId === terminalId)

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
