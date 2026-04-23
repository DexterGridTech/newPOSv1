import {applySliceSyncDiff, type StateRuntime} from '@impos2/kernel-base-state-runtime'
import type {StateSyncDiffEnvelope} from '@impos2/kernel-base-contracts'

export const createRuntimeStateSync = (stateRuntime: StateRuntime) => {
    /**
     * 设计意图：
     * topology runtime 不直接理解 Redux slice 内部结构，只通过 state-runtime 暴露的 sync 描述计算和应用 diff。
     * 这让主副屏同步能力保持通用，业务包只声明自己的 syncIntent 和字段策略。
     */
    const getSyncSlices = () => stateRuntime.getSlices().filter(slice => Boolean(slice.sync))

    const applyStateSyncDiff = (envelope: StateSyncDiffEnvelope) => {
        const state = stateRuntime.getStore().getState() as Record<string, unknown>
        const nextSlices: Record<string, unknown> = {}
        const syncMode = envelope.direction === 'master-to-slave' || envelope.direction === 'slave-to-master'
            ? 'authoritative'
            : 'latest-wins'
        const incomingSliceNames = Object.keys(envelope.diffBySlice)
        const appliedSliceNames: string[] = []
        const skippedSliceReasons: Array<{sliceName: string; reason: string}> = []

        for (const slice of stateRuntime.getSlices()) {
            const diff = envelope.diffBySlice[slice.name]
            if (!diff) {
                continue
            }
            if (!slice.sync) {
                skippedSliceReasons.push({sliceName: slice.name, reason: 'missing-sync-descriptor'})
                continue
            }

            const currentSliceState = state[slice.name]
            if (!currentSliceState || typeof currentSliceState !== 'object') {
                skippedSliceReasons.push({sliceName: slice.name, reason: 'missing-current-slice-state'})
                continue
            }

            nextSlices[slice.name] = applySliceSyncDiff(
                slice,
                currentSliceState as Record<string, unknown>,
                diff as any,
                {
                    mode: syncMode,
                },
            )
            appliedSliceNames.push(slice.name)
        }

        console.info('[runtime-state-sync-apply]', JSON.stringify({
            direction: envelope.direction,
            incomingSliceNames,
            appliedSliceNames,
            skippedSliceReasons,
        }))

        if (Object.keys(nextSlices).length > 0) {
            stateRuntime.applySlicePatches(nextSlices)
        }
    }

    return {
        getSyncSlices,
        applyStateSyncDiff,
    }
}
