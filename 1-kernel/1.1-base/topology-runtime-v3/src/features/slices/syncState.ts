import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3SyncState} from '../../types/state'
import {TOPOLOGY_V3_SYNC_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV3SyncState = {
    status: 'idle',
}

const slice = createSlice({
    name: TOPOLOGY_V3_SYNC_STATE_KEY,
    initialState,
    reducers: {
        replaceSyncState: (_state, action: PayloadAction<TopologyV3SyncState>) => ({
            ...action.payload,
        }),
        patchSyncState: (state, action: PayloadAction<Partial<TopologyV3SyncState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3SyncStateActions = slice.actions

export const topologyRuntimeV3SyncStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3SyncState> = {
    name: TOPOLOGY_V3_SYNC_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
