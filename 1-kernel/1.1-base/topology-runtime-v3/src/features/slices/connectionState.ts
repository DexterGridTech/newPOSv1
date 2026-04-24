import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3ConnectionState} from '../../types/state'
import {TOPOLOGY_V3_CONNECTION_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV3ConnectionState = {
    serverConnectionStatus: 'DISCONNECTED',
    reconnectAttempt: 0,
}

const slice = createSlice({
    name: TOPOLOGY_V3_CONNECTION_STATE_KEY,
    initialState,
    reducers: {
        replaceConnectionState: (_state, action: PayloadAction<TopologyV3ConnectionState>) => ({
            ...action.payload,
        }),
        patchConnectionState: (state, action: PayloadAction<Partial<TopologyV3ConnectionState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3ConnectionStateActions = slice.actions

export const topologyRuntimeV3ConnectionStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3ConnectionState> = {
    name: TOPOLOGY_V3_CONNECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
