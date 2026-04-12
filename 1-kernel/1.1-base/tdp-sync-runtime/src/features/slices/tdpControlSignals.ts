import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {AppError} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TdpControlSignalsState} from '../../types'
import {TDP_CONTROL_SIGNALS_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TdpControlSignalsState = {}

const slice = createSlice({
    name: TDP_CONTROL_SIGNALS_STATE_KEY,
    initialState,
    reducers: {
        setLastProtocolError(state, action: PayloadAction<AppError | null | undefined>) {
            state.lastProtocolError = action.payload ?? null
        },
        setLastEdgeDegraded(
            state,
            action: PayloadAction<TdpControlSignalsState['lastEdgeDegraded']>,
        ) {
            state.lastEdgeDegraded = action.payload ?? null
        },
        setLastRehomeRequired(
            state,
            action: PayloadAction<TdpControlSignalsState['lastRehomeRequired']>,
        ) {
            state.lastRehomeRequired = action.payload ?? null
        },
        setLastDisconnectReason(state, action: PayloadAction<string | null | undefined>) {
            state.lastDisconnectReason = action.payload ?? null
        },
    },
})

export const tdpControlSignalsActions = slice.actions

export const tdpControlSignalsSliceDescriptor: StateRuntimeSliceDescriptor<TdpControlSignalsState> = {
    name: TDP_CONTROL_SIGNALS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
