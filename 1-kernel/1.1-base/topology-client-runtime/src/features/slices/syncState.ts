import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyClientSyncState} from '../../types'
import {TOPOLOGY_CLIENT_SYNC_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyClientSyncState = {
    resumeStatus: 'idle',
    continuousSyncActive: false,
}

const slice = createSlice({
    name: TOPOLOGY_CLIENT_SYNC_STATE_KEY,
    initialState,
    reducers: {
        replaceTopologyClientSync: (_state, action: PayloadAction<TopologyClientSyncState>) => ({
            ...action.payload,
        }),
        patchTopologyClientSync: (state, action: PayloadAction<Partial<TopologyClientSyncState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyClientSyncActions = slice.actions

export const topologyClientSyncSliceDescriptor: StateRuntimeSliceDescriptor<TopologyClientSyncState> = {
    name: TOPOLOGY_CLIENT_SYNC_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
