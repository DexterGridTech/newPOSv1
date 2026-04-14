import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {ProjectionMirrorEnvelope, RequestProjection} from '@impos2/kernel-base-contracts'
import {TOPOLOGY_V2_PROJECTION_STATE_KEY} from '../../foundations/stateKeys'
import type {TopologyV2ProjectionState} from '../../types'

const initialState: TopologyV2ProjectionState = {
    requestProjections: {},
}

const slice = createSlice({
    name: TOPOLOGY_V2_PROJECTION_STATE_KEY,
    initialState,
    reducers: {
        applyProjectionMirror(state, action: PayloadAction<ProjectionMirrorEnvelope>) {
            state.requestProjections[action.payload.projection.requestId] = action.payload.projection
        },
        replaceRequestProjection(state, action: PayloadAction<RequestProjection>) {
            state.requestProjections[action.payload.requestId] = action.payload
        },
        clearRequestProjection(state, action: PayloadAction<{requestId: string}>) {
            delete state.requestProjections[action.payload.requestId]
        },
        resetProjectionState() {
            return initialState
        },
    },
})

export const topologyRuntimeV2ProjectionStateActions = slice.actions

export const topologyRuntimeV2ProjectionStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2ProjectionState> = {
    name: TOPOLOGY_V2_PROJECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
}
