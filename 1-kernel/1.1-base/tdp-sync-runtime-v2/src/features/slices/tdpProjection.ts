import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {
    TdpProjectionEntryMap,
    TdpProjectionEnvelope,
    TdpProjectionId,
    TdpProjectionState,
} from '../../types'
import {TDP_PROJECTION_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

export const toProjectionId = (input: TdpProjectionEnvelope): TdpProjectionId =>
    `${input.topic}:${input.scopeType}:${input.scopeId}:${input.itemKey}`

const ACTIVE_BUFFER_ID = 'active'

const initialState: TdpProjectionState = {
    activeBufferId: ACTIVE_BUFFER_ID,
    activeEntries: {},
}

const PROJECTION_STATE_CONTROL_KEYS = new Set([
    'activeBufferId',
    'stagedBufferId',
    'activeEntries',
    'stagedEntries',
])

const isProjectionEnvelope = (value: unknown): value is TdpProjectionEnvelope => {
    if (value == null || typeof value !== 'object') {
        return false
    }
    const candidate = value as Partial<TdpProjectionEnvelope>
    return typeof candidate.topic === 'string'
        && typeof candidate.itemKey === 'string'
        && (candidate.operation === 'upsert' || candidate.operation === 'delete')
        && typeof candidate.scopeType === 'string'
        && typeof candidate.scopeId === 'string'
        && typeof candidate.revision === 'number'
        && candidate.payload != null
        && typeof candidate.payload === 'object'
        && typeof candidate.occurredAt === 'string'
}

const applyProjectionToEntries = (
    entries: TdpProjectionEntryMap,
    item: TdpProjectionEnvelope,
) => {
    const projectionId = toProjectionId(item)
    if (item.operation === 'delete') {
        delete entries[projectionId]
        return
    }

    entries[projectionId] = item
}

const clearEntries = (entries: TdpProjectionEntryMap) => {
    Object.keys(entries).forEach(key => {
        delete entries[key]
    })
}

const normalizeHydratedRecordEntries = (state: TdpProjectionState) => {
    const rawState = state as unknown as Record<string, unknown>
    if (state.activeEntries == null) {
        state.activeEntries = {}
    }
    if (state.activeBufferId == null) {
        state.activeBufferId = ACTIVE_BUFFER_ID
    }

    Object.keys(rawState).forEach(key => {
        if (PROJECTION_STATE_CONTROL_KEYS.has(key)) {
            return
        }
        const value = rawState[key]
        if (!isProjectionEnvelope(value)) {
            return
        }
        applyProjectionToEntries(state.activeEntries, value)
        delete rawState[key]
    })
}

const slice = createSlice({
    name: TDP_PROJECTION_STATE_KEY,
    initialState,
    reducers: {
        applyProjection(state, action: PayloadAction<TdpProjectionEnvelope>) {
            normalizeHydratedRecordEntries(state)
            applyProjectionToEntries(state.activeEntries, action.payload)
        },
        replaceSnapshot(state, action: PayloadAction<TdpProjectionEnvelope[]>) {
            normalizeHydratedRecordEntries(state)
            clearEntries(state.activeEntries)
            state.stagedBufferId = undefined
            state.stagedEntries = undefined
            action.payload.forEach(item => {
                applyProjectionToEntries(state.activeEntries, item)
            })
        },
        resetProjection(state) {
            normalizeHydratedRecordEntries(state)
            clearEntries(state.activeEntries)
            state.activeBufferId = ACTIVE_BUFFER_ID
            state.stagedBufferId = undefined
            state.stagedEntries = undefined
        },
    },
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.applySnapshotLoaded, (state, action) => {
                normalizeHydratedRecordEntries(state)
                clearEntries(state.activeEntries)
                state.stagedBufferId = undefined
                state.stagedEntries = undefined
                action.payload.snapshot.forEach(item => {
                    applyProjectionToEntries(state.activeEntries, item)
                })
            })
            .addCase(tdpSyncV2DomainActions.beginSnapshotApply, (state, action) => {
                normalizeHydratedRecordEntries(state)
                state.stagedBufferId = action.payload.snapshotId
                state.stagedEntries = {}
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotChunk, (state, action) => {
                normalizeHydratedRecordEntries(state)
                if (state.stagedBufferId !== action.payload.snapshotId || state.stagedEntries == null) {
                    return
                }
                action.payload.items.forEach(item => {
                    applyProjectionToEntries(state.stagedEntries!, item)
                })
            })
            .addCase(tdpSyncV2DomainActions.commitSnapshotApply, (state, action) => {
                normalizeHydratedRecordEntries(state)
                if (state.stagedBufferId !== action.payload.snapshotId || state.stagedEntries == null) {
                    return
                }
                state.activeBufferId = action.payload.snapshotId
                state.activeEntries = state.stagedEntries
                state.stagedBufferId = undefined
                state.stagedEntries = undefined
            })
            .addCase(tdpSyncV2DomainActions.applyChangesLoaded, (state, action) => {
                normalizeHydratedRecordEntries(state)
                action.payload.changes.forEach(item => {
                    applyProjectionToEntries(state.activeEntries, item)
                })
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionReceived, (state, action) => {
                normalizeHydratedRecordEntries(state)
                applyProjectionToEntries(state.activeEntries, action.payload.change)
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionBatchReceived, (state, action) => {
                normalizeHydratedRecordEntries(state)
                action.payload.changes.forEach(item => {
                    applyProjectionToEntries(state.activeEntries, item)
                })
            })
            .addDefaultCase(state => {
                normalizeHydratedRecordEntries(state)
            })
    },
})

export const tdpProjectionV2Actions = slice.actions

export const tdpProjectionV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpProjectionState> = {
    name: TDP_PROJECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'record',
            storageKeyPrefix: 'entries',
            getEntries: state => state.activeEntries,
            shouldPersistEntry: (_entryKey, value) => value !== undefined,
            flushMode: 'debounced',
        },
    ],
}
