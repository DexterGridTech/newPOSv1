import type {
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    NodeId,
    ProjectionMirrorEnvelope,
    RequestLifecycleSnapshotEnvelope,
    StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import type {SyncStateDiff} from '@impos2/kernel-base-state-runtime'
import type {
    RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import type {
    SocketConnectionProfile,
    SocketRuntime,
} from '@impos2/kernel-base-transport-runtime'

export interface TopologyV3MasterAddress {
    address: string
}

export interface TopologyV3MasterLocator {
    masterNodeId?: string
    masterDeviceId?: string
    serverAddress: TopologyV3MasterAddress[]
    httpBaseUrl?: string
    addedAt: number
}

export interface TopologyV3ConfigState {
    instanceMode?: 'MASTER' | 'SLAVE'
    displayMode?: 'PRIMARY' | 'SECONDARY'
    enableSlave?: boolean
    masterLocator?: TopologyV3MasterLocator | null
}

export interface DeriveTopologyV3RuntimeContextInput {
    displayIndex?: number
    displayCount?: number
    configState: TopologyV3ConfigState
}

export interface TopologyV3RuntimeContext {
    displayIndex: number
    displayCount: number
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    workspace: 'MAIN' | 'BRANCH'
    standalone: boolean
    enableSlave: boolean
    masterLocator?: TopologyV3MasterLocator | null
}

export type TopologyV3ActivationStatus = 'UNACTIVATED' | 'ACTIVATED'

export type TopologyV3EligibilityReasonCode =
    | 'master-unactivated'
    | 'already-activated'
    | 'managed-secondary'
    | 'slave-instance'
    | 'activated-master-cannot-switch-to-slave'
    | 'master-primary-enable-slave'
    | 'standalone-slave-only-display-mode'

export interface TopologyV3EligibilityResult {
    allowed: boolean
    reasonCode: TopologyV3EligibilityReasonCode
}

export interface TopologyV3HelloRuntime {
    nodeId: NodeId | string
    deviceId: string
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    standalone: boolean
    protocolVersion: '2026.04-v3'
    capabilities: string[]
}

export interface TopologyV3HelloMessage {
    type: 'hello'
    helloId: string
    runtime: TopologyV3HelloRuntime
    sentAt: number
}

export interface TopologyV3HelloAckMessage {
    type: 'hello-ack'
    helloId: string
    accepted: boolean
    sessionId?: string
    peerRuntime?: TopologyV3HelloRuntime
    rejectionCode?: string
    rejectionMessage?: string
    hostTime: number
}

export interface TopologyV3StateSnapshotMessage {
    type: 'state-snapshot'
    sessionId: string
    sourceNodeId: NodeId | string
    targetNodeId?: NodeId | string
    entries: Array<{
        sliceName: string
        revision: string | number
        payload: SyncStateDiff
    }>
    sentAt: number
}

export interface TopologyV3StateUpdateMessage {
    type: 'state-update'
    sessionId: string
    sourceNodeId: NodeId | string
    targetNodeId?: NodeId | string
    sliceName: string
    revision: string | number
    payload: SyncStateDiff
    sentAt: number
}

export interface TopologyV3CommandDispatchMessage {
    type: 'command-dispatch'
    envelope: CommandDispatchEnvelope
}

export interface TopologyV3CommandEventMessage {
    type: 'command-event'
    envelope: CommandEventEnvelope
}

export interface TopologyV3RequestSnapshotMessage {
    type: 'request-snapshot'
    envelope: RequestLifecycleSnapshotEnvelope
}

export interface TopologyV3ProjectionMirrorMessage {
    type: 'projection-mirror'
    envelope: ProjectionMirrorEnvelope
}

export interface TopologyV3StateDiffMessage {
    type: 'state-diff'
    envelope: StateSyncDiffEnvelope
}

export type TopologyV3IncomingMessage =
    | TopologyV3HelloAckMessage
    | TopologyV3StateSnapshotMessage
    | TopologyV3StateUpdateMessage
    | TopologyV3CommandDispatchMessage
    | TopologyV3CommandEventMessage
    | TopologyV3RequestSnapshotMessage
    | TopologyV3ProjectionMirrorMessage
    | TopologyV3StateDiffMessage

export type TopologyV3OutgoingMessage =
    | TopologyV3HelloMessage
    | TopologyV3StateSnapshotMessage
    | TopologyV3StateUpdateMessage
    | TopologyV3CommandDispatchMessage
    | TopologyV3CommandEventMessage
    | TopologyV3RequestSnapshotMessage
    | TopologyV3ProjectionMirrorMessage
    | TopologyV3StateDiffMessage

export interface TopologyRuntimeV3SocketBinding {
    socketRuntime: SocketRuntime
    profileName: string
    profile?: SocketConnectionProfile<any, any, any, TopologyV3IncomingMessage, TopologyV3OutgoingMessage>
}

export interface TopologyRuntimeV3Assembly {
    resolveSocketBinding(context: RuntimeModuleContextV2): TopologyRuntimeV3SocketBinding | undefined
    createHelloRuntime(context: RuntimeModuleContextV2): TopologyV3HelloRuntime | undefined
}

export interface CreateTopologyRuntimeModuleV3Input {
    assembly?: TopologyRuntimeV3Assembly
    orchestrator?: TopologyPeerOrchestratorV3
    socket?: {
        reconnectAttempts?: number
        reconnectDelayMs?: number
    }
}

export interface TopologyPeerOrchestratorV3 {
    startConnection(): Promise<void>
    stopConnection(reason?: string): void
    restartConnection(reason?: string): Promise<void>
    sendStateSnapshot?(message: TopologyV3StateSnapshotMessage): void
    sendStateUpdate?(message: TopologyV3StateUpdateMessage): void
    sendCommandDispatch?(message: TopologyV3CommandDispatchMessage): void
    sendCommandEvent?(message: TopologyV3CommandEventMessage): void
    sendRequestSnapshot?(message: TopologyV3RequestSnapshotMessage): void
    sendProjectionMirror?(message: TopologyV3ProjectionMirrorMessage): void
}
