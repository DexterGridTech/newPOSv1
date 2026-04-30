import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    StateRuntimeSyncDescriptor,
    SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import type {BenefitReservation} from '@next/kernel-business-benefit-types'
import {moduleName} from '../../moduleName'
import {toBenefitContextKey} from '../../foundations/contextKey'
import type {BenefitReservationState} from '../../types'

export const BENEFIT_RESERVATION_STATE_KEY = `${moduleName}.reservation`

const initialState: BenefitReservationState = {
    byId: {},
    idsByContextKey: {},
}

const indexReservation = (state: BenefitReservationState, reservation: BenefitReservation) => {
    state.byId[reservation.reservationId] = reservation
    const contextKey = toBenefitContextKey(reservation.contextRef)
    const ids = state.idsByContextKey[contextKey] ?? []
    if (!ids.includes(reservation.reservationId)) {
        state.idsByContextKey[contextKey] = [...ids, reservation.reservationId]
    }
}

const slice = createSlice({
    name: BENEFIT_RESERVATION_STATE_KEY,
    initialState,
    reducers: {
        upsertReservations(
            state,
            action: PayloadAction<{reservations: BenefitReservation[]; changedAt: number}>,
        ) {
            action.payload.reservations.forEach(reservation => indexReservation(state, reservation))
            state.lastChangedAt = action.payload.changedAt
        },
        replaceReservation(
            state,
            action: PayloadAction<{reservation: BenefitReservation; changedAt: number}>,
        ) {
            indexReservation(state, action.payload.reservation)
            state.lastChangedAt = action.payload.changedAt
        },
        releaseContextReservations(
            state,
            action: PayloadAction<{contextKey: string; changedAt: number}>,
        ) {
            const ids = state.idsByContextKey[action.payload.contextKey] ?? []
            ids.forEach((id) => {
                const reservation = state.byId[id]
                if (!reservation) {
                    return
                }
                if (reservation.state === 'consumed' || reservation.state === 'expired') {
                    return
                }
                state.byId[id] = {
                    ...reservation,
                    state: 'released',
                    updatedAt: new Date(action.payload.changedAt).toISOString(),
                }
            })
            state.lastChangedAt = action.payload.changedAt
        },
        resetReservationState() {
            return {
                ...initialState,
                lastChangedAt: Date.now(),
            }
        },
    },
})

export const benefitReservationActions = slice.actions

const syncDescriptor: StateRuntimeSyncDescriptor<BenefitReservationState> = {
    kind: 'record' as const,
    getEntries(state: BenefitReservationState) {
        const updatedAt = state.lastChangedAt ?? 0
        return {
            byId: {value: state.byId, updatedAt},
            idsByContextKey: {value: state.idsByContextKey, updatedAt},
            lastChangedAt: {value: state.lastChangedAt, updatedAt},
        }
    },
    applyEntries(
        state: BenefitReservationState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): BenefitReservationState {
        const updatedAt = Date.now()
        return {
            byId: (entries.byId?.value as BenefitReservationState['byId'] | undefined) ?? state.byId,
            idsByContextKey: (entries.idsByContextKey?.value as BenefitReservationState['idsByContextKey'] | undefined)
                ?? state.idsByContextKey,
            lastChangedAt: (entries.lastChangedAt?.value as number | undefined) ?? updatedAt,
        }
    },
}

export const benefitReservationSliceDescriptor: StateRuntimeSliceDescriptor<BenefitReservationState> = {
    name: BENEFIT_RESERVATION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'byId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'idsByContextKey', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'lastChangedAt', flushMode: 'immediate'},
    ],
    sync: syncDescriptor,
}
