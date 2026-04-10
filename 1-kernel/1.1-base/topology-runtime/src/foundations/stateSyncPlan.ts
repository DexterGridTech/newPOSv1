import {
    createSliceSyncDiff,
    createSliceSyncSummary,
    type StateRuntimeSliceDescriptor,
    type SyncIntent,
} from '@impos2/kernel-base-state-runtime'
import type {
    TopologySyncDiffInput,
    TopologySyncSliceDiff,
    TopologySyncSliceSummary,
    TopologySyncPlanInput,
} from '../types/sync'

const filterSlicesByDirection = (
    slices: readonly StateRuntimeSliceDescriptor<any>[],
    direction: Exclude<SyncIntent, 'isolated'>,
) => slices.filter(slice => slice.syncIntent === direction && slice.sync)

export const createTopologySyncSummary = (
    input: TopologySyncPlanInput,
): TopologySyncSliceSummary[] => {
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
            } satisfies TopologySyncSliceSummary
        })
        .filter((value): value is TopologySyncSliceSummary => Boolean(value))
}

export const createTopologySyncDiff = (
    input: TopologySyncDiffInput,
): TopologySyncSliceDiff[] => {
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
            } satisfies TopologySyncSliceDiff
        })
        .filter((value): value is TopologySyncSliceDiff => Boolean(value))
}
