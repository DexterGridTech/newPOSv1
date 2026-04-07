export type CommunicationProtocol = 'http' | 'ws'

export type CommunicationAuthMode = 'none' | 'optional' | 'required'

export interface TraceContext {
  traceId?: string
  requestId?: string
  sessionId?: string
  parentTraceId?: string
}

export interface CommunicationMeta {
  auth?: CommunicationAuthMode
  timeoutMs?: number
  retry?: number
  tags?: string[]
}

export interface AddressDescriptor {
  addressName: string
  baseURL: string
  timeout?: number
}

export interface CommunicationServerConfig {
  serverName: string
  addresses: AddressDescriptor[]
  retryCount?: number
  retryInterval?: number
}

export interface CommunicationRequestContext {
  trace?: TraceContext
  extraHeaders?: Record<string, string>
  signal?: AbortSignal
}
