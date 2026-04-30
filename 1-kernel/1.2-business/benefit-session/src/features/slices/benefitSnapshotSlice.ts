import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    StateRuntimeSyncDescriptor,
    SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import type {
    ActivatedBenefitCodeResult,
    BenefitLine,
    BenefitSnapshot,
    BenefitTemplate,
} from '@next/kernel-business-benefit-types'
import {moduleName} from '../../moduleName'
import type {BenefitSessionDiagnosticEntry, BenefitSnapshotState} from '../../types'

export const BENEFIT_SNAPSHOT_STATE_KEY = `${moduleName}.snapshot`

const initialState: BenefitSnapshotState = {
    tdpTemplatesByKey: {},
    tdpLinesByKey: {},
    personalSnapshotsByEntryKey: {},
    activatedCodesByContextKey: {},
    diagnostics: [],
}

const MAX_DIAGNOSTICS = 50

const slice = createSlice({
    name: BENEFIT_SNAPSHOT_STATE_KEY,
    initialState,
    reducers: {
        upsertTdpTemplates(
            state,
            action: PayloadAction<{templates: BenefitTemplate[]; changedAt: number}>,
        ) {
            action.payload.templates.forEach((template) => {
                state.tdpTemplatesByKey[template.templateKey] = template
            })
            state.lastChangedAt = action.payload.changedAt
        },
        removeTdpTemplate(
            state,
            action: PayloadAction<{templateKey: string; changedAt: number}>,
        ) {
            delete state.tdpTemplatesByKey[action.payload.templateKey]
            state.lastChangedAt = action.payload.changedAt
        },
        upsertTdpLines(
            state,
            action: PayloadAction<{lines: BenefitLine[]; changedAt: number}>,
        ) {
            action.payload.lines.forEach((line) => {
                state.tdpLinesByKey[line.lineKey] = line
            })
            state.lastChangedAt = action.payload.changedAt
        },
        removeTdpLine(
            state,
            action: PayloadAction<{lineKey: string; changedAt: number}>,
        ) {
            delete state.tdpLinesByKey[action.payload.lineKey]
            state.lastChangedAt = action.payload.changedAt
        },
        upsertPersonalSnapshot(
            state,
            action: PayloadAction<{entryKey: string; snapshot: BenefitSnapshot; changedAt: number}>,
        ) {
            state.personalSnapshotsByEntryKey[action.payload.entryKey] = action.payload.snapshot
            state.lastChangedAt = action.payload.changedAt
        },
        addActivatedCode(
            state,
            action: PayloadAction<{contextKey: string; activation: ActivatedBenefitCodeResult; changedAt: number}>,
        ) {
            const current = state.activatedCodesByContextKey[action.payload.contextKey] ?? []
            state.activatedCodesByContextKey[action.payload.contextKey] = [
                ...current.filter(item => item.activationId !== action.payload.activation.activationId),
                action.payload.activation,
            ]
            state.lastChangedAt = action.payload.changedAt
        },
        clearActivatedCodesForContext(
            state,
            action: PayloadAction<{contextKey: string; changedAt: number}>,
        ) {
            delete state.activatedCodesByContextKey[action.payload.contextKey]
            state.lastChangedAt = action.payload.changedAt
        },
        addSnapshotDiagnostics(
            state,
            action: PayloadAction<{diagnostics: BenefitSessionDiagnosticEntry[]; changedAt: number}>,
        ) {
            state.diagnostics = [...action.payload.diagnostics, ...state.diagnostics].slice(0, MAX_DIAGNOSTICS)
            state.lastChangedAt = action.payload.changedAt
        },
        resetBenefitSnapshotState() {
            return {
                ...initialState,
                lastChangedAt: Date.now(),
            }
        },
    },
})

export const benefitSnapshotActions = slice.actions

const syncDescriptor: StateRuntimeSyncDescriptor<BenefitSnapshotState> = {
    kind: 'record' as const,
    getEntries(state: BenefitSnapshotState) {
        const updatedAt = state.lastChangedAt ?? 0
        return {
            tdpTemplatesByKey: {value: state.tdpTemplatesByKey, updatedAt},
            tdpLinesByKey: {value: state.tdpLinesByKey, updatedAt},
            personalSnapshotsByEntryKey: {value: state.personalSnapshotsByEntryKey, updatedAt},
            activatedCodesByContextKey: {value: state.activatedCodesByContextKey, updatedAt},
            diagnostics: {value: state.diagnostics, updatedAt},
            lastChangedAt: {value: state.lastChangedAt, updatedAt},
        }
    },
    applyEntries(
        state: BenefitSnapshotState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): BenefitSnapshotState {
        const updatedAt = Date.now()
        return {
            tdpTemplatesByKey: (entries.tdpTemplatesByKey?.value as BenefitSnapshotState['tdpTemplatesByKey'] | undefined)
                ?? state.tdpTemplatesByKey,
            tdpLinesByKey: (entries.tdpLinesByKey?.value as BenefitSnapshotState['tdpLinesByKey'] | undefined)
                ?? state.tdpLinesByKey,
            personalSnapshotsByEntryKey: (entries.personalSnapshotsByEntryKey?.value as BenefitSnapshotState['personalSnapshotsByEntryKey'] | undefined)
                ?? state.personalSnapshotsByEntryKey,
            activatedCodesByContextKey: (entries.activatedCodesByContextKey?.value as BenefitSnapshotState['activatedCodesByContextKey'] | undefined)
                ?? state.activatedCodesByContextKey,
            diagnostics: (entries.diagnostics?.value as BenefitSnapshotState['diagnostics'] | undefined)
                ?? state.diagnostics,
            lastChangedAt: (entries.lastChangedAt?.value as number | undefined) ?? updatedAt,
        }
    },
}

export const benefitSnapshotSliceDescriptor: StateRuntimeSliceDescriptor<BenefitSnapshotState> = {
    name: BENEFIT_SNAPSHOT_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'tdpTemplatesByKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'tdpLinesByKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'personalSnapshotsByEntryKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'activatedCodesByContextKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'diagnostics', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
    ],
    sync: syncDescriptor,
}
