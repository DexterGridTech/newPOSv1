import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    StateRuntimeSyncDescriptor,
    SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import type {CustomerIdentitySnapshot} from '@next/kernel-business-benefit-types'
import {moduleName} from '../../moduleName'
import type {BenefitIdentityState} from '../../types'

export const BENEFIT_IDENTITY_STATE_KEY = `${moduleName}.identity`

const initialState: BenefitIdentityState = {
    snapshotsByEntryKey: {},
    contextEntryKeyByContextKey: {},
}

const slice = createSlice({
    name: BENEFIT_IDENTITY_STATE_KEY,
    initialState,
    reducers: {
        upsertIdentitySnapshot(
            state,
            action: PayloadAction<{
                contextKey?: string
                entryKey: string
                snapshot: CustomerIdentitySnapshot
                changedAt: number
            }>,
        ) {
            state.snapshotsByEntryKey[action.payload.entryKey] = action.payload.snapshot
            if (action.payload.contextKey) {
                state.contextEntryKeyByContextKey[action.payload.contextKey] = action.payload.entryKey
            }
            state.lastChangedAt = action.payload.changedAt
        },
        linkContextEntryKey(
            state,
            action: PayloadAction<{contextKey: string; entryKey: string; changedAt: number}>,
        ) {
            state.contextEntryKeyByContextKey[action.payload.contextKey] = action.payload.entryKey
            state.lastChangedAt = action.payload.changedAt
        },
        unlinkContextEntryKey(
            state,
            action: PayloadAction<{contextKey: string; changedAt: number}>,
        ) {
            delete state.contextEntryKeyByContextKey[action.payload.contextKey]
            state.lastChangedAt = action.payload.changedAt
        },
        resetIdentityState() {
            return {
                ...initialState,
                lastChangedAt: Date.now(),
            }
        },
    },
})

export const benefitIdentityActions = slice.actions

const syncDescriptor: StateRuntimeSyncDescriptor<BenefitIdentityState> = {
    kind: 'record' as const,
    getEntries(state: BenefitIdentityState) {
        const updatedAt = state.lastChangedAt ?? 0
        return {
            snapshotsByEntryKey: {value: state.snapshotsByEntryKey, updatedAt},
            contextEntryKeyByContextKey: {value: state.contextEntryKeyByContextKey, updatedAt},
            lastChangedAt: {value: state.lastChangedAt, updatedAt},
        }
    },
    applyEntries(
        state: BenefitIdentityState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): BenefitIdentityState {
        const updatedAt = Date.now()
        return {
            snapshotsByEntryKey: (entries.snapshotsByEntryKey?.value as BenefitIdentityState['snapshotsByEntryKey'] | undefined)
                ?? state.snapshotsByEntryKey,
            contextEntryKeyByContextKey: (entries.contextEntryKeyByContextKey?.value as BenefitIdentityState['contextEntryKeyByContextKey'] | undefined)
                ?? state.contextEntryKeyByContextKey,
            lastChangedAt: (entries.lastChangedAt?.value as number | undefined) ?? updatedAt,
        }
    },
}

export const benefitIdentitySliceDescriptor: StateRuntimeSliceDescriptor<BenefitIdentityState> = {
    name: BENEFIT_IDENTITY_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'snapshotsByEntryKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'contextEntryKeyByContextKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
    ],
    sync: syncDescriptor,
}
