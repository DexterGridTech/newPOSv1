import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {TRANSPORT_SERVER_SPACE_STATE_KEY} from '../../foundations/stateKeys'

export interface TransportServerSpaceRuntimeState {
    selectedSpace?: string
    availableSpaces: readonly string[]
}

const initialState: TransportServerSpaceRuntimeState = {
    availableSpaces: [],
}

const slice = createSlice({
    name: TRANSPORT_SERVER_SPACE_STATE_KEY,
    initialState,
    reducers: {
        replaceServerSpaceState: (_state, action: PayloadAction<TransportServerSpaceRuntimeState>) => ({
            selectedSpace: action.payload.selectedSpace,
            availableSpaces: [...action.payload.availableSpaces],
        }),
        setSelectedServerSpace: (state, action: PayloadAction<{selectedSpace: string}>) => {
            state.selectedSpace = action.payload.selectedSpace
        },
    },
})

export const transportServerSpaceStateActions = slice.actions

export const transportServerSpaceStateSliceDescriptor: StateRuntimeSliceDescriptor<TransportServerSpaceRuntimeState> = {
    name: TRANSPORT_SERVER_SPACE_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {kind: 'field', stateKey: 'selectedSpace', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'availableSpaces', flushMode: 'immediate'},
    ],
}
