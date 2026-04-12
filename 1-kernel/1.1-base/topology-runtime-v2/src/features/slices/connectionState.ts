import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV2ConnectionState} from '../../types'
import {TOPOLOGY_V2_CONNECTION_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV2ConnectionState = {
    serverConnectionStatus: 'DISCONNECTED',
    reconnectAttempt: 0,
}

const slice = createSlice({
    name: TOPOLOGY_V2_CONNECTION_STATE_KEY,
    initialState,
    reducers: {
        replaceConnectionState: (_state, action: PayloadAction<TopologyV2ConnectionState>) => ({
            ...action.payload,
        }),
        patchConnectionState: (state, action: PayloadAction<Partial<TopologyV2ConnectionState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV2ConnectionStateActions = slice.actions

export const topologyRuntimeV2ConnectionStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2ConnectionState> = {
    name: TOPOLOGY_V2_CONNECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
