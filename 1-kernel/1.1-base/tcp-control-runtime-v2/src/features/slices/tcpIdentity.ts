import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
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

const tcpIdentitySyncDescriptor = {
    kind: 'record' as const,
    getEntries(state: TcpIdentityState) {
        const updatedAt = state.activatedAt ?? 0
        return {
            deviceFingerprint: {value: state.deviceFingerprint, updatedAt},
            deviceInfo: {value: state.deviceInfo, updatedAt},
            terminalId: {value: state.terminalId, updatedAt},
            activationStatus: {value: state.activationStatus, updatedAt},
            activatedAt: {value: state.activatedAt, updatedAt},
        }
    },
    applyEntries(
        state: TcpIdentityState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): TcpIdentityState {
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
            deviceFingerprint: resolveEntry<string | undefined>('deviceFingerprint', state.deviceFingerprint, undefined),
            deviceInfo: resolveEntry<TcpDeviceInfo | undefined>('deviceInfo', state.deviceInfo, undefined),
            terminalId: resolveEntry<string | undefined>('terminalId', state.terminalId, undefined),
            activationStatus: resolveEntry<TcpActivationStatus>('activationStatus', state.activationStatus, 'UNACTIVATED'),
            activatedAt: resolveEntry<number | undefined>('activatedAt', state.activatedAt, undefined),
        }
    },
}

export const tcpIdentityV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpIdentityState> = {
    name: TCP_IDENTITY_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'deviceFingerprint', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'deviceInfo', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'terminalId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'activationStatus', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'activatedAt', flushMode: 'immediate'},
    ],
    sync: tcpIdentitySyncDescriptor as any,
}
