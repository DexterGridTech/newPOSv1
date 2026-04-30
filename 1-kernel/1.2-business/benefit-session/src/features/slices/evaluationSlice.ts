import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    StateRuntimeSyncDescriptor,
    SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import type {BenefitApplicationInput} from '@next/kernel-business-benefit-types'
import {moduleName} from '../../moduleName'
import type {
    BenefitContextEvaluationState,
    BenefitEvaluationState,
} from '../../types'

export const BENEFIT_EVALUATION_STATE_KEY = `${moduleName}.evaluation`

const initialState: BenefitEvaluationState = {
    byContextKey: {},
}

const slice = createSlice({
    name: BENEFIT_EVALUATION_STATE_KEY,
    initialState,
    reducers: {
        replaceContextEvaluation(
            state,
            action: PayloadAction<{contextKey: string; evaluation: BenefitContextEvaluationState; changedAt: number}>,
        ) {
            state.byContextKey[action.payload.contextKey] = action.payload.evaluation
            state.lastChangedAt = action.payload.changedAt
        },
        setSelectedApplications(
            state,
            action: PayloadAction<{contextKey: string; selectedApplications: BenefitApplicationInput[]; changedAt: number}>,
        ) {
            const current = state.byContextKey[action.payload.contextKey]
            if (current) {
                current.selectedApplications = action.payload.selectedApplications
                current.stale = true
                state.lastChangedAt = action.payload.changedAt
            }
        },
        markAllEvaluationsStale(state, action: PayloadAction<{changedAt: number}>) {
            Object.values(state.byContextKey).forEach((evaluation) => {
                evaluation.stale = true
            })
            state.lastChangedAt = action.payload.changedAt
        },
        markContextStale(
            state,
            action: PayloadAction<{contextKey: string; changedAt: number}>,
        ) {
            const current = state.byContextKey[action.payload.contextKey]
            if (current) {
                current.stale = true
                state.lastChangedAt = action.payload.changedAt
            }
        },
        removeContextEvaluation(
            state,
            action: PayloadAction<{contextKey: string; changedAt: number}>,
        ) {
            delete state.byContextKey[action.payload.contextKey]
            state.lastChangedAt = action.payload.changedAt
        },
        resetEvaluationState() {
            return {
                ...initialState,
                lastChangedAt: Date.now(),
            }
        },
    },
})

export const benefitEvaluationActions = slice.actions

const syncDescriptor: StateRuntimeSyncDescriptor<BenefitEvaluationState> = {
    kind: 'record' as const,
    getEntries(state: BenefitEvaluationState) {
        const updatedAt = state.lastChangedAt ?? 0
        return {
            byContextKey: {value: state.byContextKey, updatedAt},
            lastChangedAt: {value: state.lastChangedAt, updatedAt},
        }
    },
    applyEntries(
        state: BenefitEvaluationState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): BenefitEvaluationState {
        const updatedAt = Date.now()
        return {
            byContextKey: (entries.byContextKey?.value as BenefitEvaluationState['byContextKey'] | undefined)
                ?? state.byContextKey,
            lastChangedAt: (entries.lastChangedAt?.value as number | undefined) ?? updatedAt,
        }
    },
}

export const benefitEvaluationSliceDescriptor: StateRuntimeSliceDescriptor<BenefitEvaluationState> = {
    name: BENEFIT_EVALUATION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'byContextKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
    ],
    sync: syncDescriptor,
}
