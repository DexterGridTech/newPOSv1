import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3RequestMirrorState} from '../../types/state'
import {TOPOLOGY_V3_REQUEST_MIRROR_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TopologyV3RequestMirrorState = {
    requests: {},
}

const slice = createSlice({
    name: TOPOLOGY_V3_REQUEST_MIRROR_STATE_KEY,
    initialState,
    reducers: {
        replaceRequestMirrorState: (_state, action: PayloadAction<TopologyV3RequestMirrorState>) => ({
            ...action.payload,
        }),
        patchRequestMirrorState: (state, action: PayloadAction<Partial<TopologyV3RequestMirrorState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3RequestMirrorStateActions = slice.actions

export const topologyRuntimeV3RequestMirrorStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3RequestMirrorState> = {
    name: TOPOLOGY_V3_REQUEST_MIRROR_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
