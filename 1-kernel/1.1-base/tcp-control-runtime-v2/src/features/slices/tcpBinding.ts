import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
import type {TcpBindingContext, TcpBindingState} from '../../types'
import {TCP_BINDING_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpBindingState = {}

const slice = createSlice({
    name: TCP_BINDING_STATE_KEY,
    initialState,
    reducers: {
        replaceBinding: (_state, action: PayloadAction<TcpBindingContext>) => ({
            ...action.payload,
        }),
        clearBinding: () => ({
            ...initialState,
        }),
    },
})

export const tcpBindingV2Actions = slice.actions

const tcpBindingSyncDescriptor = {
    kind: 'record' as const,
    getEntries(state: TcpBindingState) {
        const updatedAt = Object.keys(state).length > 0 ? 1 : 0
        return {
            platformId: {value: state.platformId, updatedAt},
            tenantId: {value: state.tenantId, updatedAt},
            brandId: {value: state.brandId, updatedAt},
            projectId: {value: state.projectId, updatedAt},
            storeId: {value: state.storeId, updatedAt},
            profileId: {value: state.profileId, updatedAt},
            templateId: {value: state.templateId, updatedAt},
        }
    },
    applyEntries(
        state: TcpBindingState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): TcpBindingState {
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
            platformId: resolveEntry<string | undefined>('platformId', state.platformId, undefined),
            tenantId: resolveEntry<string | undefined>('tenantId', state.tenantId, undefined),
            brandId: resolveEntry<string | undefined>('brandId', state.brandId, undefined),
            projectId: resolveEntry<string | undefined>('projectId', state.projectId, undefined),
            storeId: resolveEntry<string | undefined>('storeId', state.storeId, undefined),
            profileId: resolveEntry<string | undefined>('profileId', state.profileId, undefined),
            templateId: resolveEntry<string | undefined>('templateId', state.templateId, undefined),
        }
    },
}

export const tcpBindingV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpBindingState> = {
    name: TCP_BINDING_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'platformId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'tenantId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'brandId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'projectId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'storeId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'profileId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'templateId', flushMode: 'immediate'},
    ],
    sync: tcpBindingSyncDescriptor as any,
}
