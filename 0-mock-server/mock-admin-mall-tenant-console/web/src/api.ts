export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    message?: string
    details?: unknown
  }
}

const request = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  const payload = await response.json() as ApiResponse<T>
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message ?? `request failed: ${response.status}`)
  }
  return payload.data
}

export const api = {
  getOverview: () => request<{
    documents: Array<{domain: string; entity_type: string; count: number}>
    outbox: Array<{status: string; count: number}>
  }>('/api/v1/overview'),
  getDocuments: () => request<Array<{
    docId: string
    domain: string
    entityType: string
    entityId: string
    naturalScopeType: string
    naturalScopeKey: string
    title: string
    status: string
    sourceRevision: number
    payload: Record<string, unknown>
    updatedAt: number
  }>>('/api/v1/master-data/documents'),
  updateDocument: (
    docId: string,
    input: {
      title?: string
      status?: string
      data?: Record<string, unknown>
      payload?: Record<string, unknown>
      targetTerminalIds?: string[]
    },
  ) => request<{
    document: {
      docId: string
      domain: string
      entityType: string
      entityId: string
      naturalScopeType: string
      naturalScopeKey: string
      title: string
      status: string
      sourceRevision: number
      payload: Record<string, unknown>
      updatedAt: number
    }
    projection: {
      topicKey: string
      scopeType: string
      scopeKey: string
      itemKey: string
      sourceRevision: number
      sourceEventId: string | null
      targetTerminalIds: string[]
    }
  }>(`/api/v1/master-data/documents/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  applyDemoChange: () => request<{
    document: {
      docId: string
      domain: string
      entityType: string
      entityId: string
      naturalScopeType: string
      naturalScopeKey: string
      title: string
      status: string
      sourceRevision: number
      payload: Record<string, unknown>
      updatedAt: number
    }
    projection: {
      topicKey: string
      scopeType: string
      scopeKey: string
      itemKey: string
      sourceRevision: number
      sourceEventId: string | null
      targetTerminalIds: string[]
    }
  }>('/api/v1/master-data/demo-change', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  rebuildProjectionOutbox: (input: {
    domain?: string
    entityType?: string
    targetTerminalIds?: string[]
  } = {}) => request<{
    total: number
    rebuiltAt: number
    targetTerminalIds: string[]
    documents: Array<{
      docId: string
      title: string
      topicKey: string
      scopeType: string
      scopeKey: string
      itemKey: string
      sourceRevision: number
    }>
  }>('/api/v1/master-data/rebuild-projection-outbox', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getProjectionOutbox: () => request<Array<{
    outboxId: string
    topicKey: string
    scopeType: string
    scopeKey: string
    itemKey: string
    sourceEventId: string
    sourceRevision: number
    status: string
    attemptCount: number
    lastError?: string | null
    payload: Record<string, unknown>
    targetTerminalIds: string[]
    updatedAt: number
  }>>('/api/v1/projection-outbox'),
  previewProjectionOutbox: () => request<{
    sandboxId: string
    targetPlatformBaseUrl: string
    total: number
    projections: Array<Record<string, unknown>>
  }>('/api/v1/projection-outbox/preview', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  publishProjectionOutbox: () => request<{
    total: number
    published: number
    response: unknown
  }>('/api/v1/projection-outbox/publish', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  retryProjectionOutbox: () => request<{total: number}>('/api/v1/projection-outbox/retry', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  getTerminalAuthCapabilities: () => request<{
    status: string
    implemented: boolean
    routes: string[]
    tdpPublishPath: string
  }>('/api/v1/terminal-auth/capabilities'),
}
