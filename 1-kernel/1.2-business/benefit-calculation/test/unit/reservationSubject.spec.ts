import {describe, expect, it} from 'vitest'
import type {
    BenefitTemplate,
    CustomerIdentitySnapshot,
    PaymentInstrumentSnapshot,
} from '@next/kernel-business-benefit-types'
import {resolveReservationSubjectRef} from '../../src/pipeline/resolveReservationSubject'

const template = (subject: BenefitTemplate['reservationPolicy']['subject']): BenefitTemplate => ({
    templateKey: `tmpl-${subject}`,
    templateCode: `TMPL_${subject}`,
    version: 1,
    status: 'active',
    calculationSchemaVersion: 1,
    eligibilityPolicy: {},
    effectPolicy: {
        kind: 'amountOff',
        amount: {amount: 100, currency: 'CNY'},
    },
    basisPolicy: {
        thresholdBase: 'currentRemainingAmount',
        discountBase: 'currentRemainingAmount',
        includePriorAdjustments: true,
        includeGiftLines: false,
        includeExchangeLines: false,
    },
    selectionPolicy: {mode: 'auto'},
    reservationPolicy: {
        mode: 'autoOnOpportunity',
        subject,
        releaseOn: [],
    },
    stackingPolicy: {
        priority: 1,
        stackMode: 'stackable',
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
})

const identitySnapshot = (): CustomerIdentitySnapshot => ({
    entryIdentity: {
        identityType: 'mallMemberCard',
        identityValue: 'MALL-001',
    },
    identities: [
        {
            identityKey: 'identity-mall-001',
            identityType: 'mallMemberCard',
            identityValue: 'MALL-001',
            displayName: 'Mall member',
            status: 'active',
            memberships: [
                {
                    membershipKey: 'membership-black-001',
                    membershipType: 'mall.black-card',
                    planCode: 'MIXC_BEAUTY',
                    levelCode: 'BLACK',
                    status: 'active',
                },
            ],
        },
    ],
})

describe('resolveReservationSubjectRef', () => {
    it('resolves membership, identity, entry identity, benefit line, payment account, and custom subjects consistently', () => {
        expect(resolveReservationSubjectRef({
            template: {
                ...template('membership'),
                reservationPolicy: {
                    ...template('membership').reservationPolicy,
                    subjectMembershipType: 'mall.black-card',
                },
            },
            benefitRef: {templateKey: 'tmpl-membership'},
            identitySnapshot: identitySnapshot(),
        })).toEqual({
            subjectType: 'membership',
            subjectKey: 'membership-black-001',
            displayKey: 'BLACK',
        })

        expect(resolveReservationSubjectRef({
            template: template('identity'),
            benefitRef: {templateKey: 'tmpl-identity'},
            identitySnapshot: identitySnapshot(),
        })).toEqual({
            subjectType: 'identity',
            subjectKey: 'identity-mall-001',
            displayKey: 'Mall member',
        })

        expect(resolveReservationSubjectRef({
            template: template('entryIdentity'),
            benefitRef: {templateKey: 'tmpl-entry-identity'},
            identitySnapshot: identitySnapshot(),
        })).toEqual({
            subjectType: 'entryIdentity',
            subjectKey: 'mallMemberCard:MALL-001',
        })

        expect(resolveReservationSubjectRef({
            template: template('benefitLine'),
            benefitRef: {templateKey: 'tmpl-coupon', lineKey: 'line-coupon-001'},
            identitySnapshot: identitySnapshot(),
        })).toEqual({
            subjectType: 'benefitLine',
            subjectKey: 'line-coupon-001',
        })

        const paymentInstrument: PaymentInstrumentSnapshot = {
            instrumentType: 'storedValueCard',
            accountRef: 'stored-value-account-001',
        }
        expect(resolveReservationSubjectRef({
            template: template('paymentAccount'),
            benefitRef: {templateKey: 'tmpl-payment'},
            identitySnapshot: identitySnapshot(),
            paymentInstrument,
        })).toEqual({
            subjectType: 'paymentAccount',
            subjectKey: 'stored-value-account-001',
        })

        expect(resolveReservationSubjectRef({
            template: template('custom'),
            benefitRef: {templateKey: 'tmpl-custom', lineKey: 'line-custom'},
        })).toEqual({
            subjectType: 'custom',
            subjectKey: 'tmpl-custom:line-custom',
        })
    })

    it('returns undefined when a required subject source is missing', () => {
        expect(resolveReservationSubjectRef({
            template: template('benefitLine'),
            benefitRef: {templateKey: 'tmpl-coupon'},
            identitySnapshot: identitySnapshot(),
        })).toBeUndefined()

        expect(resolveReservationSubjectRef({
            template: template('paymentAccount'),
            benefitRef: {templateKey: 'tmpl-payment'},
            identitySnapshot: identitySnapshot(),
        })).toBeUndefined()
    })
})

