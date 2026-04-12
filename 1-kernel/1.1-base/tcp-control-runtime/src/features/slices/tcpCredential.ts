import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TcpCredentialState, TcpCredentialStatus} from '../../types'
import {TCP_CREDENTIAL_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpCredentialState = {
    status: 'EMPTY',
}

const slice = createSlice({
    name: TCP_CREDENTIAL_STATE_KEY,
    initialState,
    reducers: {
        setCredentialStatus(state, action: PayloadAction<TcpCredentialStatus>) {
            state.status = action.payload
        },
        setCredential(
            state,
            action: PayloadAction<{
                accessToken: string
                refreshToken?: string
                expiresAt: number
                refreshExpiresAt?: number
                updatedAt: number
            }>,
        ) {
            state.accessToken = action.payload.accessToken
            if (action.payload.refreshToken !== undefined) {
                state.refreshToken = action.payload.refreshToken
            }
            state.expiresAt = action.payload.expiresAt as any
            if (action.payload.refreshExpiresAt !== undefined) {
                state.refreshExpiresAt = action.payload.refreshExpiresAt as any
            }
            state.updatedAt = action.payload.updatedAt as any
            state.status = 'READY'
        },
        clearCredential(state) {
            state.accessToken = undefined
            state.refreshToken = undefined
            state.expiresAt = undefined
            state.refreshExpiresAt = undefined
            state.updatedAt = undefined
            state.status = 'EMPTY'
        },
    },
})

export const tcpCredentialActions = slice.actions

export const tcpCredentialSliceDescriptor: StateRuntimeSliceDescriptor<TcpCredentialState> = {
    name: TCP_CREDENTIAL_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {kind: 'field', stateKey: 'accessToken', protection: 'protected', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'refreshToken', protection: 'protected', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'expiresAt', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'refreshExpiresAt', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'status', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'updatedAt', flushMode: 'immediate'},
    ],
}
