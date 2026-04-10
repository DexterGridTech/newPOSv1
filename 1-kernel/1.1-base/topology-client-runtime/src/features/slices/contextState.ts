import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyClientContextState} from '../../types'
import {TOPOLOGY_CLIENT_CONTEXT_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyClientContextState = {
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
    name: TOPOLOGY_CLIENT_CONTEXT_STATE_KEY,
    initialState,
    reducers: {
        replaceTopologyClientContext: (_state, action: PayloadAction<TopologyClientContextState>) => ({
            ...action.payload,
        }),
    },
})

export const topologyClientContextActions = slice.actions

export const topologyClientContextSliceDescriptor: StateRuntimeSliceDescriptor<TopologyClientContextState> = {
    name: TOPOLOGY_CLIENT_CONTEXT_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
