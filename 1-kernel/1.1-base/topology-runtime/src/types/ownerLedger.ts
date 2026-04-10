import type {
    AppError,
    CommandDispatchEnvelope,
    CommandEventEnvelope,
    CommandId,
    NodeId,
    RequestId,
    RequestLifecycleSnapshot,
    SessionId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'
import type {RegisterRootRequestInput} from './runtime'

export type OwnerCommandNodeStatus =
    | 'registered'
    | 'dispatched'
    | 'accepted'
    | 'started'
    | 'complete'
    | 'error'

export interface OwnerCommandNode {
    commandId: CommandId
    requestId: RequestId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    commandName: string
    parentCommandId?: CommandId
    status: OwnerCommandNodeStatus
    result?: Record<string, unknown>
    error?: AppError
    startedAt?: TimestampMs
    updatedAt: TimestampMs
}

export interface OwnerLedgerRecord {
    requestId: RequestId
    ownerNodeId: NodeId
    rootCommandId: CommandId
    startedAt: TimestampMs
    updatedAt: TimestampMs
    nodes: Record<string, OwnerCommandNode>
}

export interface OwnerLedger {
    registerRootRequest(input: RegisterRootRequestInput): OwnerLedgerRecord
    registerChildDispatch(envelope: CommandDispatchEnvelope): OwnerLedgerRecord
    applyCommandEvent(envelope: CommandEventEnvelope): OwnerLedgerRecord
    exportRequestLifecycleSnapshot(requestId: RequestId, sessionId?: SessionId): RequestLifecycleSnapshot | undefined
    applyRequestLifecycleSnapshot(snapshot: RequestLifecycleSnapshot): OwnerLedgerRecord
    getRequestRecord(requestId: RequestId): OwnerLedgerRecord | undefined
    listRequestIds(input?: {
        peerNodeId?: NodeId
    }): readonly RequestId[]
    hasTrackedCommand(requestId: RequestId, commandId: CommandId): boolean
    listRecords(): readonly OwnerLedgerRecord[]
}
