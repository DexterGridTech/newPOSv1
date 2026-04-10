import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyClientPeerState} from '../../types'
import {TOPOLOGY_CLIENT_PEER_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyClientPeerState = {}

const slice = createSlice({
    name: TOPOLOGY_CLIENT_PEER_STATE_KEY,
    initialState,
    reducers: {
        replaceTopologyClientPeer: (_state, action: PayloadAction<TopologyClientPeerState>) => ({
            ...action.payload,
        }),
        patchTopologyClientPeer: (state, action: PayloadAction<Partial<TopologyClientPeerState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyClientPeerActions = slice.actions

export const topologyClientPeerSliceDescriptor: StateRuntimeSliceDescriptor<TopologyClientPeerState> = {
    name: TOPOLOGY_CLIENT_PEER_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
