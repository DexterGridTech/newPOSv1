import {benefitIdentityActions, benefitIdentitySliceDescriptor} from './identitySlice'
import {benefitSnapshotActions, benefitSnapshotSliceDescriptor} from './benefitSnapshotSlice'
import {benefitReservationActions, benefitReservationSliceDescriptor} from './reservationSlice'
import {benefitEvaluationActions, benefitEvaluationSliceDescriptor} from './evaluationSlice'

export * from './identitySlice'
export * from './benefitSnapshotSlice'
export * from './reservationSlice'
export * from './evaluationSlice'

export const benefitSessionStateSlices = [
    benefitIdentitySliceDescriptor,
    benefitSnapshotSliceDescriptor,
    benefitReservationSliceDescriptor,
    benefitEvaluationSliceDescriptor,
] as const

export const benefitSessionStateActions = {
    ...benefitIdentityActions,
    ...benefitSnapshotActions,
    ...benefitReservationActions,
    ...benefitEvaluationActions,
}
