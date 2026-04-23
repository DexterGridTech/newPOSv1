import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {moduleName} from '../../moduleName'
import type {
    CateringProductDiagnosticsEntry,
    CateringProductMasterDataState,
    CateringProductRecord,
} from '../../types'

export const CATERING_PRODUCT_MASTER_DATA_STATE_KEY = `${moduleName}.master-data`

const initialState: CateringProductMasterDataState = {
    byTopic: {},
    diagnostics: [],
}

const MAX_DIAGNOSTICS = 50

const slice = createSlice({
    name: CATERING_PRODUCT_MASTER_DATA_STATE_KEY,
    initialState,
    reducers: {
        upsertRecords(
            state,
            action: PayloadAction<{records: CateringProductRecord[]; changedAt?: number}>,
        ) {
            action.payload.records.forEach(record => {
                const byItemKey = state.byTopic[record.topic] ?? {}
                const current = byItemKey[record.itemKey]
                if (current && current.revision > record.revision) {
                    return
                }
                byItemKey[record.itemKey] = record
                state.byTopic[record.topic] = byItemKey
            })
            state.lastChangedAt = action.payload.changedAt ?? Date.now()
        },
        addDiagnostics(state, action: PayloadAction<CateringProductDiagnosticsEntry[]>) {
            state.diagnostics = [...action.payload, ...state.diagnostics].slice(0, MAX_DIAGNOSTICS)
            state.lastChangedAt = Date.now()
        },
        reset() {
            return initialState
        },
        replaceAll(state, action: PayloadAction<CateringProductMasterDataState>) {
            state.byTopic = action.payload.byTopic
            state.diagnostics = action.payload.diagnostics
            state.lastChangedAt = action.payload.lastChangedAt
        },
    },
})

export const cateringProductMasterDataActions = slice.actions

export const cateringProductMasterDataSliceDescriptor: StateRuntimeSliceDescriptor<CateringProductMasterDataState> = {
    name: CATERING_PRODUCT_MASTER_DATA_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'byTopic', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'diagnostics', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
    ],
    sync: {
        kind: 'record',
        getEntries: (state: CateringProductMasterDataState) => {
            const entries: Record<string, SyncValueEnvelope | undefined> = {}
            Object.entries(state.byTopic).forEach(([topic, records]) => {
                Object.entries(records ?? {}).forEach(([itemKey, record]) => {
                    entries[`${topic}:${itemKey}`] = {
                        value: record,
                        updatedAt: record.updatedAt,
                        tombstone: record.tombstone,
                    }
                })
            })
            return entries
        },
        applyEntries: (
            state: CateringProductMasterDataState,
            entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
        ) => {
            const next: CateringProductMasterDataState = {
                byTopic: Object.fromEntries(
                    Object.entries(state.byTopic).map(([topic, records]) => [
                        topic,
                        {...records},
                    ]),
                ),
                diagnostics: state.diagnostics,
                lastChangedAt: Date.now(),
            }
            Object.values(entries).forEach((entry: SyncValueEnvelope | undefined) => {
                if (!entry?.value || typeof entry.value !== 'object') {
                    return
                }
                const record = entry.value as CateringProductRecord
                const byItemKey = next.byTopic[record.topic] ?? {}
                if (entry.tombstone === true || record.tombstone === true) {
                    delete byItemKey[record.itemKey]
                    next.byTopic[record.topic] = byItemKey
                    return
                }
                byItemKey[record.itemKey] = record
                next.byTopic[record.topic] = byItemKey
            })
            return next
        },
    } as any,
}
