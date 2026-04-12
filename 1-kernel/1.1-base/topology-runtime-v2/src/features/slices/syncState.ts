import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV2SyncState} from '../../types'
import {TOPOLOGY_V2_SYNC_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV2SyncState = {
    resumeStatus: 'idle',
    continuousSyncActive: false,
}

const slice = createSlice({
    name: TOPOLOGY_V2_SYNC_STATE_KEY,
    initialState,
    reducers: {
        replaceSyncState: (_state, action: PayloadAction<TopologyV2SyncState>) => ({
            ...action.payload,
        }),
        patchSyncState: (state, action: PayloadAction<Partial<TopologyV2SyncState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV2SyncStateActions = slice.actions

export const topologyRuntimeV2SyncStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2SyncState> = {
    name: TOPOLOGY_V2_SYNC_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
