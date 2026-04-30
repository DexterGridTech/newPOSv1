import type {
    CommerceSubjectSnapshot,
    CompletedSettlementSnapshot,
} from '@next/kernel-business-benefit-types'

export const createFakeOrderSubject = (
    cartSubject: CommerceSubjectSnapshot,
    input: {
        completedSettlements?: CompletedSettlementSnapshot[]
    } = {},
): CommerceSubjectSnapshot => ({
    ...cartSubject,
    completedSettlements: input.completedSettlements,
})
