import type {KernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import type {UnknownAction} from '@reduxjs/toolkit'
import {selectTdpResolvedProjection} from '../selectors'
import {TDP_HOT_UPDATE_ITEM_KEY, TDP_HOT_UPDATE_TOPIC} from './hotUpdateTopic'
import {tdpHotUpdateActions} from '../features/slices/tdpHotUpdate'
import type {
    HotUpdateCurrentFacts,
    TerminalHotUpdateDesiredV1,
} from '../types'

export const reconcileHotUpdateDesiredFromResolvedProjection = async (
    runtime: Pick<KernelRuntimeV2, 'getState'> & {
        getStore?: KernelRuntimeV2['getStore']
        dispatchAction?: (action: UnknownAction) => UnknownAction
    },
    options: {
        currentFacts?: HotUpdateCurrentFacts
    } = {},
) => {
    const state = runtime.getState()
    const desired = selectTdpResolvedProjection(state, {
        topic: TDP_HOT_UPDATE_TOPIC,
        itemKey: TDP_HOT_UPDATE_ITEM_KEY,
    })?.payload as unknown as TerminalHotUpdateDesiredV1 | undefined

    const action = tdpHotUpdateActions.reconcileDesired({
        desired,
        currentFacts: options.currentFacts,
    })
    if (runtime.dispatchAction) {
        runtime.dispatchAction(action)
        return
    }
    runtime.getStore?.().dispatch(action)
}
