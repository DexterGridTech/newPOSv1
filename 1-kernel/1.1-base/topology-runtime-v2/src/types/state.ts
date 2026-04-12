import type {NodeId, NodeRuntimeInfo, RequestProjection, TimestampMs} from '@impos2/kernel-base-contracts'

export interface TopologyV2MasterAddress {
    address: string
}

export interface TopologyV2MasterInfo {
    deviceId: string
    serverAddress: TopologyV2MasterAddress[]
    addedAt: TimestampMs
}

export interface TopologyV2RecoveryState {
    instanceMode?: string
    displayMode?: string
    enableSlave?: boolean
    masterInfo?: TopologyV2MasterInfo | null
}

export interface TopologyV2ContextState {
    localNodeId: NodeId
    instanceMode: string
    displayMode: string
    workspace: string
    standalone: boolean
    enableSlave: boolean
    masterInfo?: TopologyV2MasterInfo | null
    updatedAt: TimestampMs
}

export interface TopologyV2ConnectionState {
    serverConnectionStatus: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
    connectedAt?: TimestampMs
    disconnectedAt?: TimestampMs
    connectionError?: string
    reconnectAttempt: number
    lastHelloAt?: TimestampMs
    lastResumeAt?: TimestampMs
}

export interface TopologyV2PeerState {
    peerNodeId?: NodeId
    peerDeviceId?: string
    peerInstanceMode?: string
    peerDisplayMode?: string
    peerWorkspace?: string
    connectedAt?: TimestampMs
    disconnectedAt?: TimestampMs
}

export interface TopologyV2SyncState {
    resumeStatus: 'idle' | 'pending' | 'active' | 'completed'
    activeSessionId?: string
    lastSummarySentAt?: TimestampMs
    lastDiffAppliedAt?: TimestampMs
    lastCommitAckAt?: TimestampMs
    continuousSyncActive: boolean
}

export interface TopologyRemoteDispatchResult {
    requestId: string
    commandId: string
    sessionId: string
    targetNodeId: NodeId
    startedAt: number
}

export interface TopologyProjectionMirrorState {
    requestProjections: Record<string, RequestProjection>
}

export interface TopologyPeerSessionState {
    sessionId?: string
    peerRuntime?: NodeRuntimeInfo
}
