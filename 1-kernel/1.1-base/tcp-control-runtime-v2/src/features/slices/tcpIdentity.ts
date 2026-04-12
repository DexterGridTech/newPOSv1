import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    TcpActivationStatus,
    TcpDeviceInfo,
    TcpIdentityState,
} from '../../types'
import {TCP_IDENTITY_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpIdentityState = {
    activationStatus: 'UNACTIVATED',
}

const slice = createSlice({
    name: TCP_IDENTITY_STATE_KEY,
    initialState,
    reducers: {
        setDeviceFingerprint(state, action: PayloadAction<string>) {
            state.deviceFingerprint = action.payload
        },
        setDeviceInfo(state, action: PayloadAction<TcpDeviceInfo>) {
            state.deviceInfo = action.payload
        },
        setActivationStatus(state, action: PayloadAction<TcpActivationStatus>) {
            state.activationStatus = action.payload
        },
        setActivatedIdentity(
            state,
            action: PayloadAction<{terminalId: string; activatedAt: number}>,
        ) {
            state.terminalId = action.payload.terminalId
            state.activatedAt = action.payload.activatedAt as any
            state.activationStatus = 'ACTIVATED'
        },
        clearActivation(state) {
            state.terminalId = undefined
            state.activatedAt = undefined
            state.activationStatus = 'UNACTIVATED'
        },
    },
})

export const tcpIdentityV2Actions = slice.actions

export const tcpIdentityV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpIdentityState> = {
    name: TCP_IDENTITY_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {kind: 'field', stateKey: 'deviceFingerprint', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'deviceInfo', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'terminalId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'activationStatus', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'activatedAt', flushMode: 'immediate'},
    ],
}
