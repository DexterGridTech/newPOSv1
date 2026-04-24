import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {moduleName} from '../../moduleName'
import type {
    CateringStoreOperatingDiagnosticsEntry,
    CateringStoreOperatingMasterDataState,
    CateringStoreOperatingRecord,
    CateringStoreOperatingTopic,
} from '../../types'

export const CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY = `${moduleName}.master-data`

const initialState: CateringStoreOperatingMasterDataState = {
    byTopic: {},
    diagnostics: [],
}

const createEmptyState = (changedAt?: number): CateringStoreOperatingMasterDataState => ({
    byTopic: {},
    diagnostics: [],
    lastChangedAt: changedAt,
})

const MAX_DIAGNOSTICS = 50

const slice = createSlice({
    name: CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY,
    initialState,
    reducers: {
        upsertRecords(
            state,
            action: PayloadAction<{records: CateringStoreOperatingRecord[]; changedAt?: number}>,
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
        addDiagnostics(state, action: PayloadAction<CateringStoreOperatingDiagnosticsEntry[]>) {
            state.diagnostics = [...action.payload, ...state.diagnostics].slice(0, MAX_DIAGNOSTICS)
            state.lastChangedAt = Date.now()
        },
        reset() {
            return createEmptyState(Date.now())
        },
        replaceAll(state, action: PayloadAction<CateringStoreOperatingMasterDataState>) {
            state.byTopic = action.payload.byTopic
            state.diagnostics = action.payload.diagnostics
            state.lastChangedAt = action.payload.lastChangedAt
        },
    },
})

export const cateringStoreOperatingMasterDataActions = slice.actions

export const cateringStoreOperatingMasterDataSliceDescriptor: StateRuntimeSliceDescriptor<CateringStoreOperatingMasterDataState> = {
    name: CATERING_STORE_OPERATING_MASTER_DATA_STATE_KEY,
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
        getEntries: (state: CateringStoreOperatingMasterDataState) => {
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
            state: CateringStoreOperatingMasterDataState,
            entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
        ) => {
            const next: CateringStoreOperatingMasterDataState = {
                byTopic: Object.fromEntries(
                    Object.entries(state.byTopic).map(([topic, records]) => [
                        topic,
                        {...records},
                    ]),
                ),
                diagnostics: state.diagnostics,
                lastChangedAt: Date.now(),
            }
            Object.entries(entries).forEach(([entryKey, entry]: [string, SyncValueEnvelope | undefined]) => {
                const [topic, itemKey] = entryKey.split(':', 2) as [CateringStoreOperatingTopic | undefined, string | undefined]
                if (!topic || !itemKey) {
                    return
                }
                const byItemKey = next.byTopic[topic] ?? {}
                if (entry?.tombstone === true) {
                    delete byItemKey[itemKey]
                    next.byTopic[topic] = byItemKey
                    return
                }
                if (!entry?.value || typeof entry.value !== 'object') {
                    return
                }
                const record = entry.value as CateringStoreOperatingRecord
                if (record.tombstone === true) {
                    delete byItemKey[record.itemKey]
                    next.byTopic[topic] = byItemKey
                    return
                }
                byItemKey[itemKey] = record
                next.byTopic[topic] = byItemKey
            })
            return next
        },
    } as any,
}
