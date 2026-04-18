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

/**
 * 设计意图：
 * 同步计划只使用 slice descriptor 生成 summary/diff，不直接读写具体业务字段规则。
 * 业务包通过 state-runtime 描述哪些字段可同步，topology 只负责把这些差异可靠送到 peer。
 */
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
                {
                    mode: 'authoritative',
                },
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
