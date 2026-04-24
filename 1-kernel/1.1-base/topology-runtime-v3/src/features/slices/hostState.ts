import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3HostState} from '../../types/state'
import {TOPOLOGY_V3_HOST_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV3HostState = {
    desiredRunning: false,
    actualRunning: false,
    transitionStatus: 'idle',
}

const slice = createSlice({
    name: TOPOLOGY_V3_HOST_STATE_KEY,
    initialState,
    reducers: {
        replaceHostState: (_state, action: PayloadAction<TopologyV3HostState>) => ({
            ...action.payload,
        }),
        patchHostState: (state, action: PayloadAction<Partial<TopologyV3HostState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3HostStateActions = slice.actions

export const topologyRuntimeV3HostStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3HostState> = {
    name: TOPOLOGY_V3_HOST_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
