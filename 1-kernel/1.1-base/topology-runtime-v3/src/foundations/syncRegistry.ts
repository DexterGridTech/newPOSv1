import {createEnvelopeId, nowTimestampMs, type StateSyncDiffEnvelope} from '@next/kernel-base-contracts'
import {
    createSliceSyncDiff,
    createSliceSyncSummary,
    type StateRuntimeSliceDescriptor,
} from '@next/kernel-base-state-runtime'
import type {RootState} from '@next/kernel-base-state-runtime'
import type {
    TopologyV3ContextState,
} from '../types/state'
import type {
    TopologyV3StateSnapshotMessage,
    TopologyV3StateUpdateMessage,
} from '../types/runtime'

const toDirection = (
    context: Pick<TopologyV3ContextState, 'instanceMode'>,
): 'master-to-slave' | 'slave-to-master' => (
    context.instanceMode === 'MASTER'
        ? 'master-to-slave'
        : 'slave-to-master'
)

export const getTopologyV3OutboundDirection = toDirection

export const getTopologyV3InboundDirection = (
    context: Pick<TopologyV3ContextState, 'instanceMode'>,
): 'master-to-slave' | 'slave-to-master' => (
    context.instanceMode === 'MASTER'
        ? 'slave-to-master'
        : 'master-to-slave'
)

const filterSlicesByDirection = (
    slices: readonly StateRuntimeSliceDescriptor<any>[],
    direction: 'master-to-slave' | 'slave-to-master',
) => slices.filter(slice => slice.syncIntent === direction && slice.sync)

export const createTopologyV3SnapshotMessage = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId?: string
    context: Pick<TopologyV3ContextState, 'instanceMode'>
    slices: readonly StateRuntimeSliceDescriptor<any>[]
    state: RootState
}): TopologyV3StateSnapshotMessage => {
    const direction = toDirection(input.context)
    const stateRecord = input.state as Record<string, unknown>
    const entries = filterSlicesByDirection(input.slices, direction)
        .map(slice => {
            const sliceState = stateRecord[slice.name]
            if (!sliceState || typeof sliceState !== 'object') {
                return undefined
            }
            const payload = createSliceSyncDiff(
                slice,
                sliceState as Record<string, unknown>,
                {},
                {mode: 'authoritative'},
            )
            return {
                sliceName: slice.name,
                revision: nowTimestampMs(),
                payload,
            }
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value))

    return {
        type: 'state-snapshot',
        sessionId: input.sessionId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        entries,
        sentAt: nowTimestampMs(),
    }
}

export const createTopologyV3SingleSliceUpdateMessage = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId?: string
    context: Pick<TopologyV3ContextState, 'instanceMode'>
    slice: StateRuntimeSliceDescriptor<any>
    currentState: RootState
    previousState: RootState
}): TopologyV3StateUpdateMessage | undefined => {
    if (!input.slice.sync || input.slice.syncIntent === 'isolated' || !input.slice.syncIntent) {
        return undefined
    }
    if (input.slice.syncIntent !== getTopologyV3OutboundDirection(input.context)) {
        return undefined
    }
    const currentStateRecord = input.currentState as Record<string, unknown>
    const previousStateRecord = input.previousState as Record<string, unknown>
    const currentSlice = currentStateRecord[input.slice.name]
    const previousSlice = previousStateRecord[input.slice.name]
    if (!currentSlice || typeof currentSlice !== 'object' || !previousSlice || typeof previousSlice !== 'object') {
        return undefined
    }

    const remoteSummary = createSliceSyncSummary(
        input.slice,
        previousSlice as Record<string, unknown>,
    )
    const payload = createSliceSyncDiff(
        input.slice,
        currentSlice as Record<string, unknown>,
        remoteSummary,
        {mode: 'authoritative'},
    )
    if (!payload.length) {
        return undefined
    }

    return {
        type: 'state-update',
        sessionId: input.sessionId,
        sourceNodeId: input.sourceNodeId,
        targetNodeId: input.targetNodeId,
        sliceName: input.slice.name,
        revision: nowTimestampMs(),
        payload,
        sentAt: nowTimestampMs(),
    }
}

export const createTopologyV3StateDiffEnvelopeFromSnapshot = (input: {
    message: TopologyV3StateSnapshotMessage
    localNodeId: string
    direction: 'master-to-slave' | 'slave-to-master'
}): StateSyncDiffEnvelope => ({
    envelopeId: createEnvelopeId(),
    sessionId: input.message.sessionId as any,
    sourceNodeId: input.message.sourceNodeId as any,
    targetNodeId: input.localNodeId as any,
    direction: input.direction,
    diffBySlice: Object.fromEntries(
        input.message.entries.map(entry => [entry.sliceName, entry.payload]),
    ),
    replaceMissing: true,
    sentAt: input.message.sentAt as any,
})

export const createTopologyV3StateDiffEnvelopeFromUpdate = (input: {
    message: TopologyV3StateUpdateMessage
    localNodeId: string
    direction: 'master-to-slave' | 'slave-to-master'
}): StateSyncDiffEnvelope => ({
    envelopeId: createEnvelopeId(),
    sessionId: input.message.sessionId as any,
    sourceNodeId: input.message.sourceNodeId as any,
    targetNodeId: input.localNodeId as any,
    direction: input.direction,
    diffBySlice: {
        [input.message.sliceName]: input.message.payload as any,
    },
    sentAt: input.message.sentAt as any,
})
