import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {AppError} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TcpRuntimeState} from '../../types'
import {TCP_RUNTIME_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpRuntimeState = {
    bootstrapped: false,
}

const slice = createSlice({
    name: TCP_RUNTIME_STATE_KEY,
    initialState,
    reducers: {
        setBootstrapped(state, action: PayloadAction<boolean>) {
            state.bootstrapped = action.payload
        },
        setLastActivationRequestId(state, action: PayloadAction<string | undefined>) {
            state.lastActivationRequestId = action.payload
        },
        setLastRefreshRequestId(state, action: PayloadAction<string | undefined>) {
            state.lastRefreshRequestId = action.payload
        },
        setLastTaskReportRequestId(state, action: PayloadAction<string | undefined>) {
            state.lastTaskReportRequestId = action.payload
        },
        setLastError(state, action: PayloadAction<AppError | null | undefined>) {
            state.lastError = action.payload ?? null
        },
        resetRuntimeObservation(state) {
            state.bootstrapped = false
            state.lastActivationRequestId = undefined
            state.lastRefreshRequestId = undefined
            state.lastTaskReportRequestId = undefined
            state.lastError = undefined
        },
    },
})

export const tcpRuntimeV2Actions = slice.actions

export const tcpRuntimeV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpRuntimeState> = {
    name: TCP_RUNTIME_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
