import {createSelector} from '@reduxjs/toolkit'
import type {RootState} from '@next/kernel-base-state-runtime'
import type {
    BenefitContextRef,
    BenefitEvaluationDiagnostic,
    BenefitReservation,
    BenefitSnapshot,
    CustomerIdentitySnapshot,
} from '@next/kernel-business-benefit-types'
import {toBenefitContextKey} from '../foundations/contextKey'
import {BENEFIT_EVALUATION_STATE_KEY} from '../features/slices/evaluationSlice'
import {BENEFIT_IDENTITY_STATE_KEY} from '../features/slices/identitySlice'
import {BENEFIT_RESERVATION_STATE_KEY} from '../features/slices/reservationSlice'
import {BENEFIT_SNAPSHOT_STATE_KEY} from '../features/slices/benefitSnapshotSlice'
import type {
    BenefitContextView,
    BenefitEvaluationState,
    BenefitIdentityState,
    BenefitReservationState,
    BenefitSnapshotState,
} from '../types'

export const selectBenefitIdentityState = (state: RootState) =>
    state[BENEFIT_IDENTITY_STATE_KEY as keyof RootState] as BenefitIdentityState | undefined

export const selectBenefitSnapshotState = (state: RootState) =>
    state[BENEFIT_SNAPSHOT_STATE_KEY as keyof RootState] as BenefitSnapshotState | undefined

export const selectBenefitReservationState = (state: RootState) =>
    state[BENEFIT_RESERVATION_STATE_KEY as keyof RootState] as BenefitReservationState | undefined

export const selectBenefitEvaluationState = (state: RootState) =>
    state[BENEFIT_EVALUATION_STATE_KEY as keyof RootState] as BenefitEvaluationState | undefined

export const selectBenefitIdentitySnapshotForContext = (
    state: RootState,
    contextRef: BenefitContextRef,
): CustomerIdentitySnapshot | undefined => {
    const identityState = selectBenefitIdentityState(state)
    const contextKey = toBenefitContextKey(contextRef)
    const entryKey = identityState?.contextEntryKeyByContextKey[contextKey]
    if (entryKey) {
        return identityState?.snapshotsByEntryKey[entryKey]
    }

    const snapshots = Object.values(identityState?.snapshotsByEntryKey ?? {})
    return snapshots.length === 1 ? snapshots[0] : undefined
}

export const selectBenefitSnapshotForContext = (
    state: RootState,
    contextRef: BenefitContextRef,
): BenefitSnapshot => {
    const snapshotState = selectBenefitSnapshotState(state)
    const identityState = selectBenefitIdentityState(state)
    const reservationState = selectBenefitReservationState(state)
    const contextKey = toBenefitContextKey(contextRef)
    const entryKey = identityState?.contextEntryKeyByContextKey[contextKey]
    const singleEntryKey = Object.keys(identityState?.snapshotsByEntryKey ?? {}).length === 1
        ? Object.keys(identityState?.snapshotsByEntryKey ?? {})[0]
        : undefined
    const personalSnapshot = entryKey
        ? snapshotState?.personalSnapshotsByEntryKey[entryKey]
        : singleEntryKey
            ? snapshotState?.personalSnapshotsByEntryKey[singleEntryKey]
            : undefined
    const activatedCodes = snapshotState?.activatedCodesByContextKey[contextKey] ?? []

    return mergeBenefitSnapshots([
        {
            templates: Object.values(snapshotState?.tdpTemplatesByKey ?? {}),
            lines: Object.values(snapshotState?.tdpLinesByKey ?? {}),
            reservations: [],
        },
        personalSnapshot,
        {
            templates: activatedCodes.flatMap(item => item.activatedTemplates),
            lines: activatedCodes.flatMap(item => item.activatedLines),
            reservations: [],
            activatedCodes,
        },
        {
            templates: [],
            lines: [],
            reservations: Object.values(reservationState?.byId ?? {}),
        },
    ])
}

export const selectBenefitContextView = (
    state: RootState,
    contextRef: BenefitContextRef,
): BenefitContextView => {
    const contextKey = toBenefitContextKey(contextRef)
    const evaluation = selectBenefitEvaluationState(state)?.byContextKey[contextKey]
    const snapshotState = selectBenefitSnapshotState(state)

    return {
        contextRef,
        identitySnapshot: selectBenefitIdentitySnapshotForContext(state, contextRef),
        benefitSnapshot: selectBenefitSnapshotForContext(state, contextRef),
        result: evaluation?.result,
        selectedApplications: evaluation?.selectedApplications ?? [],
        activatedCodes: snapshotState?.activatedCodesByContextKey[contextKey] ?? [],
        reservations: selectBenefitReservations(state, contextRef),
        stale: evaluation?.stale ?? true,
    }
}

export const selectBenefitApplications = createSelector(
    [
        selectBenefitEvaluationState,
        (_state: RootState, contextRef: BenefitContextRef) => toBenefitContextKey(contextRef),
    ],
    (evaluationState, contextKey) => evaluationState?.byContextKey[contextKey]?.result.applications ?? [],
)

export const selectBenefitOpportunities = createSelector(
    [
        selectBenefitEvaluationState,
        (_state: RootState, contextRef: BenefitContextRef) => toBenefitContextKey(contextRef),
    ],
    (evaluationState, contextKey) => evaluationState?.byContextKey[contextKey]?.result.opportunities ?? [],
)

export const selectBenefitPrompts = createSelector(
    [
        selectBenefitEvaluationState,
        (_state: RootState, contextRef: BenefitContextRef) => toBenefitContextKey(contextRef),
    ],
    (evaluationState, contextKey) => evaluationState?.byContextKey[contextKey]?.result.prompts ?? [],
)

export const selectBenefitReservations = (
    state: RootState,
    contextRef: BenefitContextRef,
): BenefitReservation[] => {
    const reservationState = selectBenefitReservationState(state)
    const contextKey = toBenefitContextKey(contextRef)
    return (reservationState?.idsByContextKey[contextKey] ?? [])
        .map(id => reservationState?.byId[id])
        .filter((item): item is BenefitReservation => Boolean(item))
}

export const selectBenefitDiagnostics = createSelector(
    [
        selectBenefitEvaluationState,
        selectBenefitSnapshotState,
        (_state: RootState, contextRef: BenefitContextRef) => toBenefitContextKey(contextRef),
    ],
    (evaluationState, snapshotState, contextKey): BenefitEvaluationDiagnostic[] => [
        ...(evaluationState?.byContextKey[contextKey]?.result.diagnostics ?? []),
        ...(snapshotState?.diagnostics ?? []).map(item => ({
            diagnosticId: item.diagnosticId,
            level: item.level,
            code: item.code,
            message: item.message,
        })),
    ],
)

export function mergeBenefitSnapshots(
    snapshots: Array<Partial<BenefitSnapshot> | undefined>,
): BenefitSnapshot {
    const templates = new Map<string, BenefitSnapshot['templates'][number]>()
    const lines = new Map<string, BenefitSnapshot['lines'][number]>()
    const reservations = new Map<string, BenefitReservation>()
    const completedSettlements = new Map<string, NonNullable<BenefitSnapshot['completedSettlements']>[number]>()
    const quotaFacts = new Map<string, NonNullable<BenefitSnapshot['quotaFacts']>[number]>()
    const activatedCodes = new Map<string, NonNullable<BenefitSnapshot['activatedCodes']>[number]>()

    snapshots.forEach((snapshot) => {
        snapshot?.templates?.forEach(template => templates.set(template.templateKey, template))
        snapshot?.lines?.forEach(line => lines.set(line.lineKey, line))
        snapshot?.reservations?.forEach(reservation => reservations.set(reservation.reservationId, reservation))
        snapshot?.completedSettlements?.forEach(settlement => completedSettlements.set(settlement.settlementLineId, settlement))
        snapshot?.quotaFacts?.forEach(fact => quotaFacts.set(fact.factRef ?? fact.bucketKey, fact))
        snapshot?.activatedCodes?.forEach(code => activatedCodes.set(code.activationId, code))
    })

    return {
        templates: [...templates.values()],
        lines: [...lines.values()],
        reservations: [...reservations.values()],
        completedSettlements: [...completedSettlements.values()],
        quotaFacts: [...quotaFacts.values()],
        activatedCodes: [...activatedCodes.values()],
    }
}
