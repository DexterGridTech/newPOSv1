import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyClientConnectionState} from '../../types'
import {TOPOLOGY_CLIENT_CONNECTION_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyClientConnectionState = {
    serverConnectionStatus: 'DISCONNECTED',
    reconnectAttempt: 0,
}

const slice = createSlice({
    name: TOPOLOGY_CLIENT_CONNECTION_STATE_KEY,
    initialState,
    reducers: {
        replaceTopologyClientConnection: (_state, action: PayloadAction<TopologyClientConnectionState>) => ({
            ...action.payload,
        }),
        patchTopologyClientConnection: (state, action: PayloadAction<Partial<TopologyClientConnectionState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyClientConnectionActions = slice.actions

export const topologyClientConnectionSliceDescriptor: StateRuntimeSliceDescriptor<TopologyClientConnectionState> = {
    name: TOPOLOGY_CLIENT_CONNECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
