import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV3ContextState} from '../../types/state'
import {TOPOLOGY_V3_CONTEXT_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV3ContextState = {
    localNodeId: '',
    displayIndex: 0,
    displayCount: 1,
    instanceMode: 'MASTER',
    displayMode: 'PRIMARY',
    workspace: 'MAIN',
    standalone: true,
    enableSlave: false,
    masterLocator: null,
}

const slice = createSlice({
    name: TOPOLOGY_V3_CONTEXT_STATE_KEY,
    initialState,
    reducers: {
        replaceContextState: (_state, action: PayloadAction<TopologyV3ContextState>) => ({
            ...action.payload,
        }),
    },
})

export const topologyRuntimeV3ContextStateActions = slice.actions

export const topologyRuntimeV3ContextStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3ContextState> = {
    name: TOPOLOGY_V3_CONTEXT_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
