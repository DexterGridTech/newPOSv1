import type {AppError} from './error'
import type {CommandId, EnvelopeId, NodeId, RequestId, SessionId, TimestampMs} from './ids'

export type CommandLifecycleStatus =
    | 'registered'
    | 'dispatched'
    | 'accepted'
    | 'started'
    | 'complete'
    | 'error'

export type RequestLifecycleStatus = 'started' | 'complete' | 'error'

export interface CommandResultPatch {
    commandId: CommandId
    result: Record<string, unknown>
    patchedAt: TimestampMs
}

export interface CommandResultSnapshot {
    commandId: CommandId
    result?: Record<string, unknown>
    error?: AppError
    completedAt?: TimestampMs
    erroredAt?: TimestampMs
}

export interface RequestCommandSnapshot {
    commandId: CommandId
    parentCommandId?: CommandId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    commandName: string
    status: CommandLifecycleStatus
    result?: Record<string, unknown>
    error?: AppError
    startedAt?: TimestampMs
    updatedAt: TimestampMs
}

export interface RequestLifecycleSnapshot {
    requestId: RequestId
    ownerNodeId: NodeId
    rootCommandId: CommandId
    sessionId?: SessionId
    status: RequestLifecycleStatus
    startedAt: TimestampMs
    updatedAt: TimestampMs
    commands: readonly RequestCommandSnapshot[]
    commandResults: readonly CommandResultSnapshot[]
}

export interface RequestLifecycleSnapshotEnvelope {
    envelopeId: EnvelopeId
    sessionId: SessionId
    requestId: RequestId
    ownerNodeId: NodeId
    sourceNodeId: NodeId
    targetNodeId: NodeId
    snapshot: RequestLifecycleSnapshot
    sentAt: TimestampMs
}
