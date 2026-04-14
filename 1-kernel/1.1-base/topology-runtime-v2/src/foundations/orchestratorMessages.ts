import {
    createEnvelopeId,
    nowTimestampMs,
    type NodeId,
    type RequestLifecycleSnapshot,
    type RequestLifecycleSnapshotEnvelope,
    type RequestProjection,
    type StateSyncCommitAckEnvelope,
    type StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import {type StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    CommandQueryResult,
    RequestQueryResult,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createTopologyV2SyncSummary} from './syncPlan'

const toRequestLifecycleStatus = (status: RequestQueryResult['status']): RequestLifecycleSnapshot['status'] => {
    if (status === 'COMPLETED') {
        return 'complete'
    }
    if (status === 'FAILED' || status === 'PARTIAL_FAILED' || status === 'TIMEOUT') {
        return 'error'
    }
    return 'started'
}

const toCommandLifecycleStatus = (status: CommandQueryResult['status']): RequestLifecycleSnapshot['commands'][number]['status'] => {
    if (status === 'COMPLETED') {
        return 'complete'
    }
    if (status === 'FAILED' || status === 'PARTIAL_FAILED' || status === 'TIMEOUT') {
        return 'error'
    }
    return 'started'
}

const toProjectionStatus = (status: RequestLifecycleSnapshot['status']): RequestProjection['status'] =>
    status === 'complete'
        ? 'complete'
        : status === 'error'
            ? 'error'
            : 'started'

export const buildRequestLifecycleSnapshotEnvelope = (input: {
    request: RequestQueryResult
    sessionId: string
    ownerNodeId: NodeId
    targetNodeId: NodeId
}): RequestLifecycleSnapshotEnvelope => ({
    envelopeId: createEnvelopeId(),
    sessionId: input.sessionId as any,
    requestId: input.request.requestId as any,
    ownerNodeId: input.ownerNodeId as any,
    sourceNodeId: input.ownerNodeId as any,
    targetNodeId: input.targetNodeId as any,
    snapshot: {
        requestId: input.request.requestId as any,
        ownerNodeId: input.ownerNodeId as any,
        rootCommandId: input.request.rootCommandId as any,
        sessionId: input.sessionId as any,
        status: toRequestLifecycleStatus(input.request.status),
        startedAt: input.request.startedAt as any,
        updatedAt: input.request.updatedAt as any,
        commands: input.request.commands.map(command => ({
            commandId: command.commandId as any,
            parentCommandId: command.parentCommandId as any,
            ownerNodeId: input.ownerNodeId as any,
            sourceNodeId: input.ownerNodeId as any,
            targetNodeId: input.targetNodeId as any,
            commandName: command.commandName,
            status: toCommandLifecycleStatus(command.status),
            result: command.actorResults.find(result => result.result)?.result,
            error: command.actorResults.find(result => result.error)?.error,
            startedAt: command.startedAt as any,
            updatedAt: (command.completedAt ?? command.startedAt ?? input.request.updatedAt) as any,
        })),
        commandResults: [],
    },
    sentAt: nowTimestampMs() as any,
})

export const buildRequestProjectionFromSnapshot = (input: {
    snapshot: RequestLifecycleSnapshot
    ownerNodeId: NodeId
}): RequestProjection => ({
    requestId: input.snapshot.requestId,
    ownerNodeId: input.ownerNodeId,
    status: toProjectionStatus(input.snapshot.status),
    startedAt: input.snapshot.startedAt,
    updatedAt: input.snapshot.updatedAt,
    resultsByCommand: Object.fromEntries(
        input.snapshot.commands
            .filter(command => command.result && typeof command.result === 'object')
            .map(command => [command.commandId, command.result as Record<string, unknown>]),
    ),
    mergedResults: input.snapshot.commands.reduce<Record<string, unknown>>((accumulator, command) => {
        if (command.result && typeof command.result === 'object') {
            return {
                ...accumulator,
                ...command.result as Record<string, unknown>,
            }
        }
        return accumulator
    }, {}),
    errorsByCommand: Object.fromEntries(
        input.snapshot.commands
            .filter(command => command.error)
            .map(command => [
                command.commandId,
                {
                    key: command.error!.key,
                    code: command.error!.code,
                    message: command.error!.message,
                },
            ]),
    ),
    pendingCommandCount: input.snapshot.commands.filter(command => command.status === 'started').length,
})

export const buildStateSyncSummaryEnvelope = (input: {
    sessionId: string
    sourceNodeId: NodeId
    targetNodeId: NodeId
    direction: 'master-to-slave' | 'slave-to-master'
    slices: readonly StateRuntimeSliceDescriptor<any>[]
    state: Record<string, unknown>
}): StateSyncSummaryEnvelope => ({
    envelopeId: createEnvelopeId(),
    sessionId: input.sessionId as any,
    sourceNodeId: input.sourceNodeId as any,
    targetNodeId: input.targetNodeId as any,
    direction: input.direction,
    summaryBySlice: Object.fromEntries(
        createTopologyV2SyncSummary({
            direction: input.direction,
            slices: input.slices,
            state: input.state,
        }).map(entry => [entry.sliceName, entry.summary]),
    ),
    sentAt: nowTimestampMs() as any,
})

export const buildStateSyncCommitAckEnvelope = (input: {
    sessionId: string
    sourceNodeId: NodeId
    targetNodeId: NodeId
    direction: 'master-to-slave' | 'slave-to-master'
}): StateSyncCommitAckEnvelope => ({
    envelopeId: createEnvelopeId(),
    sessionId: input.sessionId as any,
    sourceNodeId: input.sourceNodeId as any,
    targetNodeId: input.targetNodeId as any,
    direction: input.direction,
    committedAt: nowTimestampMs() as any,
})
