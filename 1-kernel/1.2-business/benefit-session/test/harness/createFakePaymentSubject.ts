import type {
    CommerceSubjectSnapshot,
    CompletedSettlementSnapshot,
    PaymentInstrumentSnapshot,
} from '@next/kernel-business-benefit-types'

export const createFakePaymentSubject = (
    orderSubject: CommerceSubjectSnapshot,
    input: {
        paymentInstrument?: PaymentInstrumentSnapshot
        completedSettlements?: CompletedSettlementSnapshot[]
    },
): CommerceSubjectSnapshot => ({
    ...orderSubject,
    paymentInstrument: input.paymentInstrument,
    completedSettlements: input.completedSettlements ?? orderSubject.completedSettlements,
})
