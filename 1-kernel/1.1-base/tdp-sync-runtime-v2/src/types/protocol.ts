import type {TdpCommandInboxItem, TdpProjectionEnvelope} from './state'

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
            runtimeIdentity?: {
                localNodeId?: string
                displayIndex?: number
                displayCount?: number
                instanceMode?: 'MASTER' | 'SLAVE'
                displayMode?: 'PRIMARY' | 'SECONDARY'
            }
        }
    }
    | {type: 'PING'}
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
            changes: TdpProjectionEnvelope[]
            nextCursor: number
        }
    }
    | {
        type: 'COMMAND_DELIVERED'
        eventId: string
        timestamp: number
        data: Omit<TdpCommandInboxItem, 'receivedAt'>
    }
    | {
        type: 'PONG'
        data: {
            timestamp: number
        }
    }
    | {
        type: 'EDGE_DEGRADED'
        data: NonNullable<import('./state').TdpControlSignalsState['lastEdgeDegraded']>
    }
    | {
        type: 'SESSION_REHOME_REQUIRED'
        data: NonNullable<import('./state').TdpControlSignalsState['lastRehomeRequired']>
    }
    | {
        type: 'ERROR'
        error: {
            code: string
            message: string
            details?: unknown
        }
    }

export interface TdpSnapshotResponse {
    success: boolean
    data: TdpProjectionEnvelope[]
    error?: {
        message: string
        details?: unknown
    }
}

export interface TdpChangesResponse {
    success: boolean
    data: {
        terminalId: string
        changes: TdpProjectionEnvelope[]
        nextCursor: number
        hasMore: boolean
        highWatermark: number
    }
    error?: {
        message: string
        details?: unknown
    }
}
