import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
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

export const tcpCredentialV2Actions = slice.actions

const tcpCredentialSyncDescriptor = {
    kind: 'record' as const,
    getEntries(state: TcpCredentialState) {
        const updatedAt = state.updatedAt ?? 0
        return {
            accessToken: {value: state.accessToken, updatedAt},
            refreshToken: {value: state.refreshToken, updatedAt},
            expiresAt: {value: state.expiresAt, updatedAt},
            refreshExpiresAt: {value: state.refreshExpiresAt, updatedAt},
            status: {value: state.status, updatedAt},
            updatedAt: {value: state.updatedAt, updatedAt},
        }
    },
    applyEntries(
        state: TcpCredentialState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): TcpCredentialState {
        const resolveEntry = <TValue>(
            key: string,
            fallback: TValue,
            tombstoneFallback: TValue,
        ): TValue => {
            if (!Object.prototype.hasOwnProperty.call(entries, key)) {
                return fallback
            }
            const entry = entries[key]
            if (!entry || entry.tombstone) {
                return tombstoneFallback
            }
            return entry.value as TValue
        }
        return {
            accessToken: resolveEntry<string | undefined>('accessToken', state.accessToken, undefined),
            refreshToken: resolveEntry<string | undefined>('refreshToken', state.refreshToken, undefined),
            expiresAt: resolveEntry<number | undefined>('expiresAt', state.expiresAt, undefined),
            refreshExpiresAt: resolveEntry<number | undefined>('refreshExpiresAt', state.refreshExpiresAt, undefined),
            status: resolveEntry<TcpCredentialStatus>('status', state.status, 'EMPTY'),
            updatedAt: resolveEntry<number | undefined>('updatedAt', state.updatedAt, undefined),
        }
    },
}

export const tcpCredentialV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpCredentialState> = {
    name: TCP_CREDENTIAL_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'accessToken', protection: 'protected', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'refreshToken', protection: 'protected', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'expiresAt', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'refreshExpiresAt', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'status', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'updatedAt', flushMode: 'immediate'},
    ],
    sync: tcpCredentialSyncDescriptor as any,
}
