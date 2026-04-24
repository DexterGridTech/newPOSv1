import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {AppError} from '@next/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TdpControlSignalsState} from '../../types'
import {TDP_CONTROL_SIGNALS_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

const initialState: TdpControlSignalsState = {}

const slice = createSlice({
    name: TDP_CONTROL_SIGNALS_STATE_KEY,
    initialState,
    reducers: {
        setLastProtocolError(state, action: PayloadAction<AppError | null | undefined>) {
            state.lastProtocolError = action.payload ?? null
        },
        setLastEdgeDegraded(state, action: PayloadAction<TdpControlSignalsState['lastEdgeDegraded']>) {
            state.lastEdgeDegraded = action.payload ?? null
        },
        setLastRehomeRequired(state, action: PayloadAction<TdpControlSignalsState['lastRehomeRequired']>) {
            state.lastRehomeRequired = action.payload ?? null
        },
        setLastDisconnectReason(state, action: PayloadAction<string | null | undefined>) {
            state.lastDisconnectReason = action.payload ?? null
        },
    },
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, state => {
                state.lastProtocolError = null
                state.lastEdgeDegraded = null
                state.lastRehomeRequired = null
                state.lastDisconnectReason = null
            })
            .addCase(tdpSyncV2DomainActions.applyEdgeDegraded, (state, action) => {
                state.lastEdgeDegraded = action.payload
            })
            .addCase(tdpSyncV2DomainActions.applySessionRehomeRequired, (state, action) => {
                state.lastRehomeRequired = action.payload
            })
            .addCase(tdpSyncV2DomainActions.applyProtocolFailed, (state, action) => {
                state.lastProtocolError = action.payload
            })
    },
})

export const tdpControlSignalsV2Actions = slice.actions

export const tdpControlSignalsV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpControlSignalsState> = {
    name: TDP_CONTROL_SIGNALS_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
