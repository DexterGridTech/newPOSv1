import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV2PeerState} from '../../types'
import {TOPOLOGY_V2_PEER_STATE_KEY} from '../../foundations/stateKeys'

const slice = createSlice({
    name: TOPOLOGY_V2_PEER_STATE_KEY,
    initialState: {} as TopologyV2PeerState,
    reducers: {
        replacePeerState: (_state, action: PayloadAction<TopologyV2PeerState>) => ({
            ...action.payload,
        }),
        patchPeerState: (state, action: PayloadAction<Partial<TopologyV2PeerState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV2PeerStateActions = slice.actions

export const topologyRuntimeV2PeerStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2PeerState> = {
    name: TOPOLOGY_V2_PEER_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
