import type {NodeId, TimestampMs} from '@impos2/kernel-base-contracts'
import type {TopologyMasterInfo} from '@impos2/kernel-base-topology-runtime'

export interface TopologyClientContextState {
    localNodeId: NodeId
    instanceMode: string
    displayMode: string
    workspace: string
    standalone: boolean
    enableSlave: boolean
    masterInfo?: TopologyMasterInfo | null
    updatedAt: TimestampMs
}

export interface TopologyClientConnectionState {
    serverConnectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    connectedAt?: TimestampMs
    disconnectedAt?: TimestampMs
    connectionError?: string
    reconnectAttempt: number
    lastHelloAt?: TimestampMs
    lastResumeAt?: TimestampMs
}

export interface TopologyClientPeerState {
    peerNodeId?: NodeId
    peerDeviceId?: string
    peerInstanceMode?: string
    peerDisplayMode?: string
    peerWorkspace?: string
    connectedAt?: TimestampMs
    disconnectedAt?: TimestampMs
}

export interface TopologyClientSyncState {
    resumeStatus: 'idle' | 'pending' | 'active' | 'completed'
    activeSessionId?: string
    lastSummarySentAt?: TimestampMs
    lastDiffAppliedAt?: TimestampMs
    lastCommitAckAt?: TimestampMs
    continuousSyncActive: boolean
}
