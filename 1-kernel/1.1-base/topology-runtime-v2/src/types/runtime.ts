import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    NodeHello,
    NodeRuntimeInfo,
    ProjectionMirrorEnvelope,
    RequestId,
    RequestLifecycleSnapshot,
    RequestLifecycleSnapshotEnvelope,
    StateSyncCommitAckEnvelope,
    StateSyncDiffEnvelope,
    StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import type {
    CommandIntent,
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {SocketConnectionProfile, SocketRuntime} from '@impos2/kernel-base-transport-runtime'
import type {
    TopologyRemoteDispatchResult,
    TopologyV2MasterInfo,
    TopologyPeerSessionState,
} from './state'

export interface TopologyRuntimeV2SocketBinding {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<any, any, any, TopologyRuntimeV2IncomingMessage, TopologyRuntimeV2OutgoingMessage>
}

export interface TopologyRuntimeV2Assembly {
    resolveSocketBinding(context: RuntimeModuleContextV2): TopologyRuntimeV2SocketBinding | undefined
    createHello(context: RuntimeModuleContextV2): NodeHello | undefined
    getRuntimeInfo?(context: RuntimeModuleContextV2): NodeRuntimeInfo | undefined
    getResumeSnapshotRequestIds?(context: RuntimeModuleContextV2): readonly string[]
}

export interface CreateTopologyRuntimeModuleV2Input {
    assembly?: TopologyRuntimeV2Assembly
    socket?: {
        reconnectAttempts?: number
    }
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
    masterInfo: TopologyV2MasterInfo
}

export interface DispatchPeerCommandInput<TPayload = unknown> {
    requestId: RequestId
    parentCommandId: string
    targetNodeId: string
    commandName: string
    payload: TPayload
}

export interface TopologyRuntimeV2HelloMessage {
    type: 'node-hello'
    hello: NodeHello
}

export interface TopologyRuntimeV2HelloAckMessage {
    type: 'node-hello-ack'
    ack: import('@impos2/kernel-base-contracts').NodeHelloAck
}

export interface TopologyRuntimeV2ResumeBeginMessage {
    type: 'resume-begin'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface TopologyRuntimeV2ResumeCompleteMessage {
    type: 'resume-complete'
    sessionId: string
    nodeId: string
    timestamp: number
}

export interface TopologyRuntimeV2HeartbeatMessage {
    type: '__host_heartbeat'
    timestamp: number
}

export interface TopologyRuntimeV2HeartbeatAckMessage {
    type: '__host_heartbeat_ack'
    timestamp: number
}

export interface TopologyRuntimeV2DispatchMessage {
    type: 'command-dispatch'
    envelope: CommandDispatchEnvelope
}

export interface TopologyRuntimeV2CommandEventMessage {
    type: 'command-event'
    envelope: CommandEventEnvelope
}

export interface TopologyRuntimeV2RequestLifecycleSnapshotMessage {
    type: 'request-lifecycle-snapshot'
    envelope: RequestLifecycleSnapshotEnvelope
}

export interface TopologyRuntimeV2ProjectionMirrorMessage {
    type: 'projection-mirror'
    envelope: ProjectionMirrorEnvelope
}

export interface TopologyRuntimeV2StateSyncSummaryMessage {
    type: 'state-sync-summary'
    envelope: StateSyncSummaryEnvelope
}

export interface TopologyRuntimeV2StateSyncDiffMessage {
    type: 'state-sync-diff'
    envelope: StateSyncDiffEnvelope
}

export interface TopologyRuntimeV2StateSyncCommitAckMessage {
    type: 'state-sync-commit-ack'
    envelope: StateSyncCommitAckEnvelope
}

export type TopologyRuntimeV2IncomingMessage =
    | TopologyRuntimeV2HeartbeatMessage
    | TopologyRuntimeV2HelloAckMessage
    | TopologyRuntimeV2ResumeBeginMessage
    | TopologyRuntimeV2DispatchMessage
    | TopologyRuntimeV2CommandEventMessage
    | TopologyRuntimeV2RequestLifecycleSnapshotMessage
    | TopologyRuntimeV2ProjectionMirrorMessage
    | TopologyRuntimeV2StateSyncSummaryMessage
    | TopologyRuntimeV2StateSyncDiffMessage
    | TopologyRuntimeV2StateSyncCommitAckMessage

export type TopologyRuntimeV2OutgoingMessage =
    | TopologyRuntimeV2HeartbeatAckMessage
    | TopologyRuntimeV2HelloMessage
    | TopologyRuntimeV2ResumeBeginMessage
    | TopologyRuntimeV2ResumeCompleteMessage
    | TopologyRuntimeV2DispatchMessage
    | TopologyRuntimeV2CommandEventMessage
    | TopologyRuntimeV2RequestLifecycleSnapshotMessage
    | TopologyRuntimeV2ProjectionMirrorMessage
    | TopologyRuntimeV2StateSyncSummaryMessage
    | TopologyRuntimeV2StateSyncDiffMessage
    | TopologyRuntimeV2StateSyncCommitAckMessage

export interface TopologyPeerGatewayV2 {
    dispatchCommand<TPayload = unknown>(
        command: CommandIntent<TPayload>,
        options: {
            requestId?: string
            parentCommandId?: string
            routeContext?: import('@impos2/kernel-base-contracts').CommandRouteContext
        },
    ): Promise<import('@impos2/kernel-base-runtime-shell-v2').CommandAggregateResult>
}

export interface TopologyPeerOrchestratorV2 {
    startConnection(): Promise<void>
    stopConnection(reason?: string): void
    restartConnection(reason?: string): Promise<void>
    beginResume(requestIds?: readonly string[]): void
    dispatchRemoteCommand<TPayload = unknown>(input: DispatchPeerCommandInput<TPayload>): Promise<TopologyRemoteDispatchResult>
    sendRemoteDispatch(message: Extract<TopologyRuntimeV2OutgoingMessage, {type: 'command-dispatch'}>): void
    sendCommandEvent(message: Extract<TopologyRuntimeV2OutgoingMessage, {type: 'command-event'}>): void
    sendRequestLifecycleSnapshot(envelope: RequestLifecycleSnapshotEnvelope): void
    sendProjectionMirror(envelope: ProjectionMirrorEnvelope): void
    getSessionContext(): TopologyPeerSessionState
}

export interface TopologyRuntimeModuleFactoryV2 {
    (input?: CreateTopologyRuntimeModuleV2Input): KernelRuntimeModuleV2
}

export interface TopologyRequestMirror {
    exportRequestLifecycleSnapshot(requestId: RequestId, sessionId?: string): RequestLifecycleSnapshot | undefined
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): void
}
