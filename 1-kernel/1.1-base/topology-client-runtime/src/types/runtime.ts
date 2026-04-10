import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    CommandId,
    NodeHello,
    NodeHelloAck,
    NodeId,
    NodeRuntimeInfo,
    RequestId,
    RequestLifecycleSnapshotEnvelope,
    SessionId,
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {
    TopologyMasterInfo,
    TopologyRuntime,
} from '@impos2/kernel-base-topology-runtime'
import type {
    RuntimeModuleContext,
    RuntimeModuleInstallContext,
} from '@impos2/kernel-base-runtime-shell'
import type {
    SocketConnectionProfile,
    SocketRuntime,
} from '@impos2/kernel-base-transport-runtime'
import type {
    TopologyClientConnectionState,
    TopologyClientContextState,
    TopologyClientPeerState,
    TopologyClientSyncState,
} from './state'

export interface CreateTopologyClientContextInput {
    localNodeId: string
    topology: TopologyRuntime
    displayIndex?: number
    displayCount?: number
    updatedAt?: number
}

export interface TopologyClientRuntimeState {
    context: TopologyClientContextState
    connection: TopologyClientConnectionState
    peer: TopologyClientPeerState
    sync: TopologyClientSyncState
}

export interface TopologyClientRuntimeContext extends RuntimeModuleContext {}

export interface TopologyClientRuntimeInstallContext extends RuntimeModuleInstallContext {}

export interface DispatchRemoteCommandInput<TPayload = unknown> {
    requestId: RequestId
    parentCommandId: CommandId
    targetNodeId: NodeId
    commandName: string
    payload: TPayload
}

export interface SetTopologyInstanceModeInput {
    instanceMode: string
}

export interface SetTopologyDisplayModeInput {
    displayMode: string
}

export interface SetTopologyEnableSlaveInput {
    enableSlave: boolean
}

export interface SetTopologyMasterInfoInput {
    masterInfo: TopologyMasterInfo
}

export interface DispatchRemoteCommandResult extends Record<string, unknown> {
    requestId: RequestId
    commandId: CommandId
    sessionId: SessionId
    targetNodeId: NodeId
    startedAt: number
}

export interface TopologyClientHeartbeatEnvelope {
    type: '__host_heartbeat'
    timestamp: number
}

export interface TopologyClientHeartbeatAckEnvelope {
    type: '__host_heartbeat_ack'
    timestamp: number
}

export interface TopologyClientHelloMessage {
    type: 'node-hello'
    hello: NodeHello
}

export interface TopologyClientHelloAckMessage {
    type: 'node-hello-ack'
    ack: NodeHelloAck
}

export interface TopologyClientResumeBeginMessage {
    type: 'resume-begin'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface TopologyClientResumeCompleteMessage {
    type: 'resume-complete'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface TopologyClientDispatchMessage {
    type: 'command-dispatch'
    envelope: CommandDispatchEnvelope
}

export interface TopologyClientCommandEventMessage {
    type: 'command-event'
    envelope: CommandEventEnvelope
}

export interface TopologyClientRequestLifecycleSnapshotMessage {
    type: 'request-lifecycle-snapshot'
    envelope: RequestLifecycleSnapshotEnvelope
}

export interface TopologyClientStateSyncSummaryMessage {
    type: 'state-sync-summary'
    envelope: StateSyncSummaryEnvelope
}

export interface TopologyClientStateSyncDiffMessage {
    type: 'state-sync-diff'
    envelope: StateSyncDiffEnvelope
}

export interface TopologyClientStateSyncCommitAckMessage {
    type: 'state-sync-commit-ack'
    envelope: StateSyncCommitAckEnvelope
}

export type TopologyClientIncomingMessage =
    | TopologyClientHeartbeatEnvelope
    | TopologyClientHelloAckMessage
    | TopologyClientResumeBeginMessage
    | TopologyClientDispatchMessage
    | TopologyClientCommandEventMessage
    | TopologyClientRequestLifecycleSnapshotMessage
    | TopologyClientStateSyncSummaryMessage
    | TopologyClientStateSyncDiffMessage
    | TopologyClientStateSyncCommitAckMessage

export type TopologyClientOutgoingMessage =
    | TopologyClientHeartbeatAckEnvelope
    | TopologyClientHelloMessage
    | TopologyClientResumeBeginMessage
    | TopologyClientResumeCompleteMessage
    | TopologyClientDispatchMessage
    | TopologyClientCommandEventMessage
    | TopologyClientRequestLifecycleSnapshotMessage
    | TopologyClientStateSyncSummaryMessage
    | TopologyClientStateSyncDiffMessage
    | TopologyClientStateSyncCommitAckMessage

export interface TopologyClientSocketBinding {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<any, any, any, TopologyClientIncomingMessage, TopologyClientOutgoingMessage>
}

export interface TopologyClientAssembly {
    resolveSocketBinding(context: TopologyClientRuntimeInstallContext): TopologyClientSocketBinding | undefined
    createHello(context: TopologyClientRuntimeInstallContext): NodeHello | undefined
    getRuntimeInfo?(context: TopologyClientRuntimeInstallContext): NodeRuntimeInfo | undefined
    getResumeSnapshotRequestIds?(context: TopologyClientRuntimeInstallContext): readonly string[]
}

export interface CreateTopologyClientRuntimeModuleInput {
    assembly?: TopologyClientAssembly
}

export interface TopologyClientSessionContext {
    sessionId?: SessionId
    peerRuntime?: NodeRuntimeInfo
}
