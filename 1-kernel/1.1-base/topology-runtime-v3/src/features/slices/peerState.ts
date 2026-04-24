import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3PeerState} from '../../types/state'
import {TOPOLOGY_V3_PEER_STATE_KEY} from '../../foundations/stateKeys'

const slice = createSlice({
    name: TOPOLOGY_V3_PEER_STATE_KEY,
    initialState: {} as TopologyV3PeerState,
    reducers: {
        replacePeerState: (_state, action: PayloadAction<TopologyV3PeerState>) => ({
            ...action.payload,
        }),
        patchPeerState: (state, action: PayloadAction<Partial<TopologyV3PeerState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3PeerStateActions = slice.actions

export const topologyRuntimeV3PeerStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3PeerState> = {
    name: TOPOLOGY_V3_PEER_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
