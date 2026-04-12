import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV2ContextState} from '../../types'
import {TOPOLOGY_V2_CONTEXT_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV2ContextState = {
    localNodeId: '' as any,
    instanceMode: 'MASTER',
    displayMode: 'PRIMARY',
    workspace: 'MAIN',
    standalone: true,
    enableSlave: false,
    masterInfo: null,
    updatedAt: 0 as any,
}

const slice = createSlice({
    name: TOPOLOGY_V2_CONTEXT_STATE_KEY,
    initialState,
    reducers: {
        replaceContextState: (_state, action: PayloadAction<TopologyV2ContextState>) => ({
            ...action.payload,
        }),
    },
})

export const topologyRuntimeV2ContextStateActions = slice.actions

export const topologyRuntimeV2ContextStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2ContextState> = {
    name: TOPOLOGY_V2_CONTEXT_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
