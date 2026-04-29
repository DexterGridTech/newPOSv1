export type TdpClientMessage =
  | {
      type: 'HANDSHAKE'
      data: {
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
      }
    }
  | {
      type: 'PING'
    }
  | {
      type: 'STATE_REPORT'
      data: {
        lastAppliedCursor?: number
        connectionMetrics?: Record<string, unknown>
        localStoreMetrics?: Record<string, unknown>
      }
    }
  | {
      type: 'ACK'
      data: {
        cursor: number
        topic?: string
        itemKey?: string
        instanceId?: string
      }
    }
  | {
      type: 'BATCH_ACK'
      data: {
        nextCursor: number
        batchId?: string
        processingLagMs?: number
        subscriptionHash?: string
      }
    }

export interface TdpProjectionEnvelope {
  topic: string
  itemKey: string
  operation: 'upsert' | 'delete'
  scopeType: string
  scopeId: string
  revision: number
  payload: Record<string, unknown>
  occurredAt: string
  sourceReleaseId?: string | null
  scopeMetadata?: Record<string, unknown>
  expiresAt?: string | null
  lifecycle?: 'persistent' | 'expiring'
  expiryReason?: 'TTL_EXPIRED' | 'PUBLISHER_DELETE' | null
}

export type TdpServerMessage =
  | {
      type: 'SESSION_READY'
      data: {
        sessionId: string
        nodeId: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        highWatermark: number
        syncMode: 'incremental' | 'full'
        alternativeEndpoints: string[]
        serverTime?: string
        serverTimestamp?: number
        subscription?: {
          version: 1
          mode: 'explicit' | 'legacy-all'
          hash?: string
          acceptedTopics: string[]
          rejectedTopics: string[]
          requiredMissingTopics: string[]
        }
      }
    }
  | {
      type: 'FULL_SNAPSHOT'
      data: {
        terminalId: string
        snapshot: TdpProjectionEnvelope[]
        highWatermark: number
      }
    }
  | {
      type: 'SNAPSHOT_BEGIN'
      data: {
        terminalId: string
        snapshotId: string
        totalChunks: number
        totalItems: number
        highWatermark: number
        subscriptionHash?: string
      }
    }
  | {
      type: 'SNAPSHOT_CHUNK'
      data: {
        snapshotId: string
        chunkIndex: number
        items: TdpProjectionEnvelope[]
      }
    }
  | {
      type: 'SNAPSHOT_END'
      data: {
        snapshotId: string
        checksum?: string
      }
    }
  | {
      type: 'CHANGESET'
      data: {
        terminalId: string
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        hasMore: boolean
        highWatermark: number
      }
    }
  | {
      type: 'PROJECTION_CHANGED'
      eventId: string
      timestamp: number
      data: {
        cursor: number
        change: TdpProjectionEnvelope
      }
    }
  | {
      type: 'PROJECTION_BATCH'
      eventId: string
      timestamp: number
      data: {
        batchId?: string
        changes: TdpProjectionEnvelope[]
        nextCursor: number
      }
    }
  | {
      type: 'COMMAND_DELIVERED'
      eventId: string
      timestamp: number
      data: {
        commandId: string
        topic: string
        terminalId: string
        payload: Record<string, unknown>
        sourceReleaseId?: string | null
        expiresAt?: string | null
      }
    }
  | {
      type: 'PONG'
      data: {
        timestamp: number
      }
    }
  | {
      type: 'EDGE_DEGRADED'
      data: {
        reason: string
        issuedAt: string
        nodeState: 'healthy' | 'grace' | 'degraded'
        gracePeriodSeconds: number
        alternativeEndpoints: string[]
      }
    }
  | {
      type: 'SESSION_REHOME_REQUIRED'
      data: {
        reason: string
        deadline: string
        alternativeEndpoints: string[]
      }
    }
  | {
      type: 'ERROR'
      error: {
        code: string
        message: string
        details?: unknown
      }
    }

export const parseClientMessage = (raw: string): TdpClientMessage => {
  const payload = JSON.parse(raw) as TdpClientMessage
  if (!payload || typeof payload !== 'object' || typeof payload.type !== 'string') {
    throw new Error('消息格式非法')
  }
  return payload
}
