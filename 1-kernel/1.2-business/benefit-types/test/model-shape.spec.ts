import {describe, expect, it} from 'vitest'
import {
    type BenefitEvaluationRequest,
    type BenefitLine,
    type BenefitTemplate,
    type CommerceSubjectSnapshot,
} from '../src'

describe('benefit transaction model shape', () => {
    it('models a transaction-only benefit template without issuer or sponsor calculation fields', () => {
        const template = {
            templateKey: 'tmpl-black-card-8-off',
            templateCode: 'BLACK_CARD_DAILY_8_OFF',
            version: 1,
            status: 'active',
            calculationSchemaVersion: 1,
            eligibilityPolicy: {
                membershipRequirements: [
                    {
                        membershipType: 'mall.black-card',
                        levelCodes: ['BLACK'],
                    },
                ],
            },
            effectPolicy: {
                kind: 'ratioOff',
                discountRatio: 0.8,
            },
            basisPolicy: {
                thresholdBase: 'originalAmount',
                discountBase: 'currentRemainingAmount',
                includePriorAdjustments: true,
                includeGiftLines: false,
                includeExchangeLines: false,
            },
            selectionPolicy: {
                mode: 'auto',
                trigger: 'identityLinked',
            },
            reservationPolicy: {
                mode: 'autoOnOpportunity',
                subject: 'membership',
                subjectMembershipType: 'mall.black-card',
                releaseOn: ['cartCanceled', 'orderCanceled', 'paymentTimeout', 'identityChanged'],
            },
            stackingPolicy: {
                priority: 100,
                stackMode: 'exclusive',
            },
            transactionStackingPolicy: {
                defaultRelation: 'shareable',
                conflictResolution: 'priority',
                rules: [],
            },
            allocationPolicy: {
                target: 'matchedLines',
                method: 'byAmountRatio',
                rounding: 'floorToCent',
                remainder: 'largestAmountLine',
                includeZeroAmountLines: false,
                refundReversal: 'byOriginalAllocation',
            },
            settlementPolicy: {
                createSettlementLineCandidate: false,
                settlementLineType: 'pricing_adjustment_record',
                amountRole: 'payableImpact',
                copySettlementPayload: true,
            },
            lifecyclePolicy: {
                refundBehavior: 'returnBenefit',
                partialRefundBehavior: 'byOriginalAllocation',
            },
            templatePayloadSnapshot: {
                displayName: '黑金卡每日 8 折',
                faceAmount: 0,
            },
        } satisfies BenefitTemplate

        expect(template.templateKey).toBe('tmpl-black-card-8-off')
    })

    it('keeps loyalty identity separate from account-style payment benefit lines', () => {
        const line = {
            lineKey: 'points-account-001',
            templateKey: 'tmpl-points-deduction',
            lineType: 'account',
            ownerIdentityKey: 'identity-mall-member-001',
            quantity: 6000,
            status: 'available',
            settlementPayload: {
                externalSystemCode: 'mall-loyalty',
                externalLineNo: 'points-account-001',
            },
        } satisfies BenefitLine

        expect(line.quantity).toBe(6000)
    })

    it('marks completed settlements on the commerce subject as the authoritative transaction facts', () => {
        const subject = {
            terminalNo: 'TERM-001',
            currency: 'CNY',
            lines: [
                {
                    lineId: 'line-1',
                    quantity: 1,
                    originalUnitPrice: {amount: 10000, currency: 'CNY'},
                    originalLineAmount: {amount: 10000, currency: 'CNY'},
                    currentUnitPrice: {amount: 10000, currency: 'CNY'},
                    currentLineAmount: {amount: 10000, currency: 'CNY'},
                    productIdentities: [
                        {
                            identityType: 'skuId',
                            identityValue: 'sku-store-001',
                            ownerScope: 'store-001',
                        },
                    ],
                    benefitParticipation: {
                        mode: 'eligible',
                    },
                },
            ],
            totals: {
                originalAmount: {amount: 10000, currency: 'CNY'},
                currentAmount: {amount: 10000, currency: 'CNY'},
                payableAmount: {amount: 8000, currency: 'CNY'},
            },
            completedSettlements: [
                {
                    settlementLineId: 'settlement-coupon-001',
                    lineType: 'coupon_deduction',
                    benefitRef: {
                        templateKey: 'tmpl-coupon-100',
                        lineKey: 'coupon-line-001',
                    },
                    coverageAmount: {amount: 2000, currency: 'CNY'},
                    payableImpactAmount: {amount: 2000, currency: 'CNY'},
                    completedAt: '2026-04-30T00:00:00.000Z',
                    status: 'completed',
                },
            ],
        } satisfies CommerceSubjectSnapshot

        expect(subject.completedSettlements?.[0]?.payableImpactAmount.amount).toBe(2000)
    })

    it('builds evaluation requests from opaque context refs and standard snapshots', () => {
        const request = {
            contextRef: {
                contextType: 'cart',
                contextId: 'cart-A',
                isCurrent: true,
            },
            stage: 'cart',
            subject: {
                terminalNo: 'TERM-001',
                currency: 'CNY',
                lines: [],
                totals: {
                    originalAmount: {amount: 0, currency: 'CNY'},
                    currentAmount: {amount: 0, currency: 'CNY'},
                    payableAmount: {amount: 0, currency: 'CNY'},
                },
            },
            benefitSnapshot: {
                templates: [],
                lines: [],
                reservations: [],
            },
            selectedApplications: [],
        } satisfies BenefitEvaluationRequest

        expect(request.contextRef.contextId).toBe('cart-A')
    })
})
