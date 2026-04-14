import {
    createSliceSyncDiff,
    createSliceSyncSummary,
    type StateRuntimeSliceDescriptor,
    type SyncIntent,
} from '@impos2/kernel-base-state-runtime'
import type {
    TopologyV2SyncDiffInput,
    TopologyV2SyncPlanInput,
    TopologyV2SyncSliceDiff,
    TopologyV2SyncSliceSummary,
} from '../types'

const filterSlicesByDirection = (
    slices: readonly StateRuntimeSliceDescriptor<any>[],
    direction: Exclude<SyncIntent, 'isolated'>,
) => slices.filter(slice => slice.syncIntent === direction && slice.sync)

export const createTopologyV2SyncSummary = (
    input: TopologyV2SyncPlanInput,
): TopologyV2SyncSliceSummary[] => {
    return filterSlicesByDirection(input.slices, input.direction)
        .map(slice => {
            const sliceState = input.state[slice.name]
            if (!sliceState || typeof sliceState !== 'object') {
                return undefined
            }

            const summary = createSliceSyncSummary(
                slice,
                sliceState as Record<string, unknown>,
            )

            if (Object.keys(summary).length === 0) {
                return undefined
            }

            return {
                sliceName: slice.name,
                summary,
            } satisfies TopologyV2SyncSliceSummary
        })
        .filter((value): value is TopologyV2SyncSliceSummary => Boolean(value))
}

export const createTopologyV2SyncDiff = (
    input: TopologyV2SyncDiffInput,
): TopologyV2SyncSliceDiff[] => {
    return filterSlicesByDirection(input.slices, input.direction)
        .map(slice => {
            const sliceState = input.state[slice.name]
            if (!sliceState || typeof sliceState !== 'object') {
                return undefined
            }

            const diff = createSliceSyncDiff(
                slice,
                sliceState as Record<string, unknown>,
                input.remoteSummaryBySlice[slice.name] ?? {},
            )

            if (diff.length === 0) {
                return undefined
            }

            return {
                sliceName: slice.name,
                diff,
            } satisfies TopologyV2SyncSliceDiff
        })
        .filter((value): value is TopologyV2SyncSliceDiff => Boolean(value))
}
