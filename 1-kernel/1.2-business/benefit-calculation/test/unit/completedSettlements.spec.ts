import {describe, expect, it} from 'vitest'
import {resolveCompletedSettlements} from '../../src/pipeline/resolveCompletedSettlements'
import type {BenefitEvaluationRequest} from '@next/kernel-business-benefit-types'

describe('resolveCompletedSettlements', () => {
    it('uses commerce subject completed settlements before benefit snapshot copies', () => {
        const request = {
            contextRef: {contextType: 'payment', contextId: 'pay-1'},
            stage: 'payment',
            subject: {
                terminalNo: 'TERM-001',
                currency: 'CNY',
                lines: [],
                totals: {
                    originalAmount: {amount: 10000, currency: 'CNY'},
                    currentAmount: {amount: 10000, currency: 'CNY'},
                    payableAmount: {amount: 10000, currency: 'CNY'},
                },
                completedSettlements: [
                    {
                        settlementLineId: 'subject-fact',
                        lineType: 'coupon_deduction',
                        coverageAmount: {amount: 2000, currency: 'CNY'},
                        payableImpactAmount: {amount: 2000, currency: 'CNY'},
                        completedAt: '2026-04-30T00:00:00.000Z',
                        status: 'completed',
                    },
                ],
            },
            benefitSnapshot: {
                templates: [],
                lines: [],
                reservations: [],
                completedSettlements: [
                    {
                        settlementLineId: 'snapshot-copy',
                        lineType: 'coupon_deduction',
                        coverageAmount: {amount: 1000, currency: 'CNY'},
                        payableImpactAmount: {amount: 1000, currency: 'CNY'},
                        completedAt: '2026-04-30T00:00:00.000Z',
                        status: 'completed',
                    },
                ],
            },
        } satisfies BenefitEvaluationRequest

        expect(resolveCompletedSettlements(request).map((item) => item.settlementLineId)).toEqual(['subject-fact'])
    })
})
