import {describe, expect, it} from 'vitest'
import {evaluateBenefitRequest} from '../../src'
import type {
    BenefitEvaluationRequest,
    BenefitLine,
    BenefitTemplate,
    CommerceLineSnapshot,
    CustomerIdentitySnapshot,
    Money,
} from '@next/kernel-business-benefit-types'

const money = (amount: number): Money => ({amount, currency: 'CNY'})

const baseLine = (lineId: string, amount: number): CommerceLineSnapshot => ({
    lineId,
    quantity: 1,
    originalUnitPrice: money(amount),
    originalLineAmount: money(amount),
    currentUnitPrice: money(amount),
    currentLineAmount: money(amount),
    productIdentities: [
        {
            identityType: 'skuId',
            identityValue: `sku-${lineId}`,
            ownerScope: 'store-001',
        },
    ],
    benefitParticipation: {
        mode: 'eligible',
    },
})

const scopedLine = (lineId: string, amount: number, skuId: string): CommerceLineSnapshot => ({
    ...baseLine(lineId, amount),
    productIdentities: [
        {
            identityType: 'skuId',
            identityValue: skuId,
            ownerScope: 'store-001',
        },
    ],
})

const categoryLine = (
    lineId: string,
    amount: number,
    categoryId: string,
    saleProductTypeCode?: string,
): CommerceLineSnapshot => ({
    ...baseLine(lineId, amount),
    categoryPath: [
        {
            categoryId,
            ownerScope: 'store-001',
        },
    ],
    saleProductTypeCode,
})

const amountOffTemplate = (templateKey = 'tmpl-full-reduction'): BenefitTemplate => ({
    templateKey,
    templateCode: 'FULL_100_MINUS_20',
    version: 1,
    status: 'active',
    calculationSchemaVersion: 1,
    eligibilityPolicy: {
        thresholdRequirements: [
            {
                thresholdType: 'amount',
                operator: 'gte',
                amount: money(10000),
            },
        ],
    },
    effectPolicy: {
        kind: 'amountOff',
        amount: money(2000),
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
        trigger: 'cartChanged',
    },
    reservationPolicy: {
        mode: 'none',
        subject: 'custom',
        releaseOn: [],
    },
    stackingPolicy: {
        priority: 10,
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

const mallBlackCardIdentity = (membershipKey = 'membership-black-001'): CustomerIdentitySnapshot => ({
    entryIdentity: {
        identityType: 'mallMember',
        identityValue: '13800000000',
        credentialType: 'phone',
    },
    identities: [
        {
            identityKey: 'identity-mall-001',
            identityType: 'mallMember',
            identityValue: '13800000000',
            status: 'active',
            memberships: [
                {
                    membershipKey,
                    membershipType: 'mall.black-card',
                    planCode: 'MALL-BEAUTY',
                    levelCode: 'BLACK',
                    levelCodes: ['BLACK'],
                    status: 'active',
                },
            ],
        },
    ],
})

const requestOf = (template: BenefitTemplate, lines: CommerceLineSnapshot[]): BenefitEvaluationRequest => ({
    contextRef: {
        contextType: 'cart',
        contextId: 'cart-A',
        isCurrent: true,
    },
    stage: 'cart',
    subject: {
        terminalNo: 'TERM-001',
        currency: 'CNY',
        lines,
        totals: {
            originalAmount: money(lines.reduce((sum, line) => sum + line.originalLineAmount.amount, 0)),
            currentAmount: money(lines.reduce((sum, line) => sum + line.currentLineAmount.amount, 0)),
            payableAmount: money(lines.reduce((sum, line) => sum + (line.payableAmount?.amount ?? line.currentLineAmount.amount), 0)),
        },
    },
    benefitSnapshot: {
        templates: [template],
        lines: [],
        reservations: [],
    },
    selectedApplications: [],
})

describe('benefit evaluation golden scenarios', () => {
    it('G01 applies automatic order amount-off without reservation', () => {
        const result = evaluateBenefitRequest(requestOf(amountOffTemplate(), [baseLine('1', 12000)]))

        expect(result.opportunities).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-full-reduction'},
                availability: 'available',
            },
        ])
        expect(result.applications).toHaveLength(1)
        expect(result.pricingAdjustments).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-full-reduction'},
                amount: money(2000),
                targetLineIds: ['1'],
                priceEffect: 'amountOff',
                affectsOrderPayable: true,
            },
        ])
        expect(result.settlementLines).toHaveLength(0)
    })

    it('G02 excludes lines that declare excludeAllBenefits and reports a reason', () => {
        const excluded = {
            ...baseLine('1', 12000),
            benefitParticipation: {
                mode: 'excludeAllBenefits' as const,
                reasonCode: 'no-benefit-product',
            },
        }

        const result = evaluateBenefitRequest(requestOf(amountOffTemplate(), [excluded]))

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'productExcluded',
                    lineIds: ['1'],
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
        expect(result.pricingAdjustments).toHaveLength(0)
        expect(result.diagnostics.some((item) => item.code === 'productExcluded')).toBe(true)
    })

    it('G04 reports a usable manual coupon opportunity without applying it', () => {
        const manualCoupon = {
            ...amountOffTemplate('tmpl-manual-coupon'),
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'coupon_deduction' as const,
                quantityUnit: 'piece' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(manualCoupon, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [manualCoupon],
                lines: [
                    {
                        lineKey: 'coupon-line-001',
                        templateKey: 'tmpl-manual-coupon',
                        lineType: 'asset',
                        quantity: 1,
                        status: 'available',
                    },
                ],
                reservations: [],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-manual-coupon',
                    lineKey: 'coupon-line-001',
                },
                availability: 'available',
                requiredAction: 'selectBenefit',
            },
        ])
        expect(result.applications).toHaveLength(0)
        expect(result.pricingAdjustments).toHaveLength(0)
        expect(result.settlementLines).toHaveLength(0)
    })

    it('G05 creates a coupon settlement candidate only after manual selection', () => {
        const manualCoupon = {
            ...amountOffTemplate('tmpl-manual-coupon'),
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'coupon_deduction' as const,
                quantityUnit: 'piece' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
            settlementPayload: {
                externalSystemCode: 'coupon-center',
                faceAmount: 2000,
            },
        } satisfies BenefitTemplate
        const couponLine = {
            lineKey: 'coupon-line-001',
            templateKey: 'tmpl-manual-coupon',
            lineType: 'asset',
            quantity: 1,
            status: 'available',
            settlementPayload: {
                externalLineNo: 'COUPON-001',
            },
        } satisfies BenefitLine

        const result = evaluateBenefitRequest({
            ...requestOf(manualCoupon, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [manualCoupon],
                lines: [couponLine],
                reservations: [],
            },
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-manual-coupon',
                        lineKey: 'coupon-line-001',
                    },
                    selectedQuantity: 1,
                },
            ],
        })

        expect(result.applications).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-manual-coupon',
                    lineKey: 'coupon-line-001',
                },
                state: 'selected',
            },
        ])
        expect(result.settlementLines).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-manual-coupon',
                    lineKey: 'coupon-line-001',
                },
                lineType: 'coupon_deduction',
                quantity: 1,
                quantityUnit: 'piece',
                payableImpactAmount: money(2000),
                settlementPayloadSnapshot: {
                    externalSystemCode: 'coupon-center',
                    externalLineNo: 'COUPON-001',
                    faceAmount: 2000,
                },
            },
        ])
    })

    it('G06 keeps payment method discount as a prompt until a payment instrument is selected', () => {
        const template = {
            ...amountOffTemplate('tmpl-stored-value-discount'),
            eligibilityPolicy: {
                paymentInstrumentScope: {
                    instrumentTypes: ['storedValueCard'],
                },
            },
            effectPolicy: {
                kind: 'paymentMethodDiscount' as const,
                discountAmount: money(2000),
            },
            selectionPolicy: {
                mode: 'conditional' as const,
                trigger: 'paymentInstrumentSelected' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'payment_method_discount' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 10000)]))

        expect(result.prompts).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-stored-value-discount'},
                triggerAction: 'selectPaymentInstrument',
                effectPreview: {
                    effectKind: 'paymentMethodDiscount',
                    estimatedAmount: money(2000),
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
        expect(result.settlementLines).toHaveLength(0)
    })

    it('G07 separates point quantity from payable impact amount', () => {
        const template = {
            ...amountOffTemplate('tmpl-points'),
            effectPolicy: {
                kind: 'pointsDeduction' as const,
                pointsPerMoneyUnit: 100,
                maxPoints: 5000,
            },
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'points_deduction' as const,
                quantityUnit: 'point' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate
        const line = {
            lineKey: 'points-account',
            templateKey: 'tmpl-points',
            lineType: 'account',
            quantity: 6000,
            status: 'available',
        } satisfies BenefitLine

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 10000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [line],
                reservations: [],
            },
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-points',
                        lineKey: 'points-account',
                    },
                    selectedQuantity: 5000,
                },
            ],
        })

        expect(result.settlementLines).toMatchObject([
            {
                lineType: 'points_deduction',
                quantity: 5000,
                quantityUnit: 'point',
                payableImpactAmount: money(5000),
            },
        ])
    })

    it('G08 exposes gift pool as a chooseGift opportunity without applying lines', () => {
        const template = {
            ...amountOffTemplate('tmpl-gift-pool'),
            effectPolicy: {
                kind: 'giftPool' as const,
                chooseQuantity: 1,
                candidates: [
                    {
                        candidateLineId: 'gift-sample-001',
                        quantity: 1,
                        displayName: 'sample',
                    },
                ],
            },
            selectionPolicy: {
                mode: 'clerkChoose' as const,
            },
            fulfillmentPolicy: {
                materialization: 'giftPool' as const,
                selectionMode: 'clerkChoose' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 12000)]))

        expect(result.opportunities).toMatchObject([
            {
                availability: 'available',
                requiredAction: 'chooseGift',
            },
        ])
        expect(result.fulfillmentEffects).toHaveLength(0)
        expect(result.settlementLines).toHaveLength(0)
    })

    it('G09 materializes an exchange line and writeoff settlement after selection', () => {
        const template = {
            ...amountOffTemplate('tmpl-exchange'),
            eligibilityPolicy: {},
            effectPolicy: {
                kind: 'exchangeLine' as const,
                exchangeLine: {
                    candidateLineId: 'exchange-sku-001',
                    quantity: 1,
                    displayName: 'exchange item',
                },
                payableAmount: money(0),
            },
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'exchange_benefit_writeoff' as const,
                quantityUnit: 'piece' as const,
                amountRole: 'benefitValueOnly' as const,
                copySettlementPayload: true,
            },
            fulfillmentPolicy: {
                materialization: 'exchangeLine' as const,
                selectionMode: 'auto' as const,
            },
        } satisfies BenefitTemplate
        const line = {
            lineKey: 'exchange-line-001',
            templateKey: 'tmpl-exchange',
            lineType: 'asset',
            quantity: 1,
            status: 'available',
        } satisfies BenefitLine

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 1000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [line],
                reservations: [],
            },
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-exchange',
                        lineKey: 'exchange-line-001',
                    },
                },
            ],
        })

        expect(result.fulfillmentEffects).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-exchange',
                    lineKey: 'exchange-line-001',
                },
                effectType: 'exchangeLine',
                selectedLines: [
                    {
                        fulfillmentLineId: 'exchange-sku-001',
                        quantity: 1,
                    },
                ],
            },
        ])
        expect(result.settlementLines).toMatchObject([
            {
                lineType: 'exchange_benefit_writeoff',
                quantity: 1,
                quantityUnit: 'piece',
            },
        ])
    })

    it('G10 applies buy 3 free 1 to the lowest priced line', () => {
        const template = {
            ...amountOffTemplate('tmpl-buy3free1'),
            effectPolicy: {
                kind: 'buyNFreeM' as const,
                buyQuantity: 3,
                freeQuantity: 1,
                freeTarget: 'lowestPrice' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(
            requestOf(template, [baseLine('a', 5000), baseLine('b', 3000), baseLine('c', 2000)]),
        )

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(2000),
                targetLineIds: ['c'],
                priceEffect: 'buyNFreeM',
            },
        ])
    })

    it('G11 discounts the nth item by cart order', () => {
        const template = {
            ...amountOffTemplate('tmpl-second-half'),
            effectPolicy: {
                kind: 'nthItemDiscount' as const,
                n: 2,
                discountRatio: 0.5,
                sortOrder: 'byCartOrder' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('first', 8000), baseLine('second', 6000)]))

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(3000),
                targetLineIds: ['second'],
                priceEffect: 'nthItemDiscount',
            },
        ])
    })

    it('G12 creates a payment group with external request amount for prepaid card discount', () => {
        const template = {
            ...amountOffTemplate('tmpl-prepaid-8-off'),
            eligibilityPolicy: {
                paymentInstrumentScope: {
                    instrumentTypes: ['prepaidCard'],
                },
            },
            effectPolicy: {
                kind: 'paymentMethodDiscount' as const,
                discountRatio: 0.2,
            },
            selectionPolicy: {
                mode: 'conditional' as const,
                trigger: 'paymentInstrumentSelected' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'payment_method_discount' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate

        const request = requestOf(template, [baseLine('1', 10000)])
        const result = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                paymentInstrument: {
                    instrumentType: 'prepaidCard',
                    accountRef: 'card-001',
                },
            },
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-prepaid-8-off',
                    },
                },
            ],
        })

        expect(result.settlementGroups).toMatchObject([
            {
                coverageAmount: money(10000),
                refundAnchorAmount: money(10000),
                externalRequestAmount: money(8000),
            },
        ])
        expect(result.settlementLines).toMatchObject([
            {
                lineType: 'stored_value_deduction',
                payableImpactAmount: money(8000),
                externalRequestAmount: money(8000),
            },
            {
                lineType: 'payment_method_discount',
                payableImpactAmount: money(2000),
                benefitValueAmount: money(2000),
            },
        ])
    })

    it('G16 applies the highest matched tier only', () => {
        const template = {
            ...amountOffTemplate('tmpl-tiered'),
            effectPolicy: {
                kind: 'tieredDiscount' as const,
                tierSelection: 'highestMatched' as const,
                tiers: [
                    {
                        threshold: {
                            thresholdType: 'amount',
                            operator: 'gte',
                            amount: money(10000),
                        },
                        effect: {
                            kind: 'amountOff' as const,
                            amount: money(1000),
                        },
                    },
                    {
                        threshold: {
                            thresholdType: 'amount',
                            operator: 'gte',
                            amount: money(20000),
                        },
                        effect: {
                            kind: 'amountOff' as const,
                            amount: money(3000),
                        },
                    },
                ],
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 25000)]))

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(3000),
                priceEffect: 'amountOff',
            },
        ])
    })

    it('G17 applies bundle price when all slots match and allocates the bundle discount', () => {
        const template = {
            ...amountOffTemplate('tmpl-bundle'),
            effectPolicy: {
                kind: 'bundlePrice' as const,
                bundlePrice: money(9900),
                matchingStrategy: 'cartOrder' as const,
                bundleSlots: [
                    {
                        slotKey: 'A',
                        quantity: 1,
                        productScope: {
                            mode: 'include' as const,
                            identityMatchers: [{identityType: 'skuId', values: ['sku-A']}],
                        },
                    },
                    {
                        slotKey: 'B',
                        quantity: 1,
                        productScope: {
                            mode: 'include' as const,
                            identityMatchers: [{identityType: 'skuId', values: ['sku-B']}],
                        },
                    },
                ],
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(
            requestOf(template, [scopedLine('a', 6000, 'sku-A'), scopedLine('b', 5000, 'sku-B')]),
        )

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(1100),
                targetLineIds: ['a', 'b'],
                priceEffect: 'bundlePrice',
            },
        ])
        expect(result.allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount.amount, 0)).toBe(1100)
    })

    it('G18 creates a service entitlement writeoff settlement candidate', () => {
        const template = {
            ...amountOffTemplate('tmpl-service'),
            effectPolicy: {
                kind: 'serviceEntitlement' as const,
                serviceCode: 'MAKEUP_TRIAL',
                times: 1,
                displayName: 'makeup trial',
            },
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'service_benefit_writeoff' as const,
                quantityUnit: 'times' as const,
                amountRole: 'benefitValueOnly' as const,
                copySettlementPayload: true,
            },
            fulfillmentPolicy: {
                materialization: 'serviceLine' as const,
                selectionMode: 'clerkChoose' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-service',
                    },
                },
            ],
        })

        expect(result.fulfillmentEffects).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-service',
                },
                effectType: 'serviceLine',
            },
        ])
        expect(result.settlementLines).toMatchObject([
            {
                lineType: 'service_benefit_writeoff',
                quantity: 1,
                quantityUnit: 'times',
                payableImpactAmount: money(0),
            },
        ])
    })

    it('G03 reports another cart reservation as unavailable for the same benefit line', () => {
        const template = {
            ...amountOffTemplate('tmpl-reserved-coupon'),
            selectionPolicy: {
                mode: 'manual' as const,
            },
            reservationPolicy: {
                mode: 'onSelection' as const,
                subject: 'benefitLine' as const,
                releaseOn: ['cartCanceled'] as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [
                    {
                        lineKey: 'coupon-line-locked',
                        templateKey: 'tmpl-reserved-coupon',
                        lineType: 'asset',
                        quantity: 1,
                        status: 'available',
                    },
                ],
                reservations: [
                    {
                        reservationId: 'reservation-A',
                        benefitRef: {
                            templateKey: 'tmpl-reserved-coupon',
                            lineKey: 'coupon-line-locked',
                        },
                        subjectRef: {
                            subjectType: 'benefitLine',
                            subjectKey: 'coupon-line-locked',
                        },
                        contextRef: {
                            contextType: 'cart',
                            contextId: 'cart-A',
                        },
                        quantity: 1,
                        state: 'held_by_cart',
                        idempotencyKey: 'reservation-A',
                        createdAt: '2026-04-30T00:00:00.000Z',
                        updatedAt: '2026-04-30T00:00:00.000Z',
                    },
                ],
            },
            contextRef: {
                contextType: 'cart',
                contextId: 'cart-B',
                isCurrent: true,
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'reservedByOtherContext',
                    contextRef: {
                        contextId: 'cart-A',
                    },
                },
            },
        ])
    })

    it('G13 calculates payment method discount from remaining payable after completed settlements', () => {
        const template = {
            ...amountOffTemplate('tmpl-payment-discount-after-facts'),
            eligibilityPolicy: {
                paymentInstrumentScope: {
                    instrumentTypes: ['prepaidCard'],
                },
            },
            effectPolicy: {
                kind: 'paymentMethodDiscount' as const,
                discountRatio: 0.2,
            },
            selectionPolicy: {
                mode: 'conditional' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'payment_method_discount' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate
        const request = requestOf(template, [baseLine('1', 30000)])

        const result = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                paymentInstrument: {
                    instrumentType: 'prepaidCard',
                },
                completedSettlements: [
                    {
                        settlementLineId: 'coupon-100',
                        lineType: 'coupon_deduction',
                        coverageAmount: money(10000),
                        payableImpactAmount: money(10000),
                        completedAt: '2026-04-30T00:00:00.000Z',
                        status: 'completed',
                    },
                    {
                        settlementLineId: 'wechat-150',
                        lineType: 'wechat_pay',
                        coverageAmount: money(15000),
                        payableImpactAmount: money(15000),
                        completedAt: '2026-04-30T00:01:00.000Z',
                        status: 'completed',
                    },
                ],
            },
            selectedApplications: [{benefitRef: {templateKey: 'tmpl-payment-discount-after-facts'}}],
        })

        expect(result.settlementGroups).toMatchObject([
            {
                coverageAmount: money(5000),
                externalRequestAmount: money(4000),
            },
        ])
    })

    it('G14 reports exclusive stacking conflict instead of applying both benefits', () => {
        const first = {
            ...amountOffTemplate('tmpl-first'),
            stackingPolicy: {
                priority: 20,
                stackMode: 'exclusive' as const,
                groupKey: 'order-price',
            },
        } satisfies BenefitTemplate
        const second = {
            ...amountOffTemplate('tmpl-second'),
            stackingPolicy: {
                priority: 10,
                stackMode: 'exclusive' as const,
                groupKey: 'order-price',
            },
        } satisfies BenefitTemplate

        const request = requestOf(first, [baseLine('1', 12000)])
        const result = evaluateBenefitRequest({
            ...request,
            benefitSnapshot: {
                templates: [first, second],
                lines: [],
                reservations: [],
            },
        })

        expect(result.applications.map((item) => item.benefitRef.templateKey)).toEqual(['tmpl-first'])
        expect(result.pricingAdjustments.map((item) => item.benefitRef.templateKey)).toEqual(['tmpl-first'])
        expect(result.diagnostics).toMatchObject([
            {
                code: 'stackingConflict',
                benefitRef: {templateKey: 'tmpl-second'},
            },
        ])
    })

    it('G15 marks an opportunity unavailable when quota facts have exhausted the bucket', () => {
        const template = {
            ...amountOffTemplate('tmpl-daily-quota'),
            reservationPolicy: {
                mode: 'autoOnOpportunity' as const,
                subject: 'membership' as const,
                quotaBucket: {
                    bucketKey: 'black-card-daily-8-off',
                    window: 'perDay' as const,
                    limitQuantity: 2,
                    factSources: ['orderFact' as const],
                },
                releaseOn: ['cartCanceled' as const],
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [],
                reservations: [],
                quotaFacts: [
                    {
                        bucketKey: 'black-card-daily-8-off',
                        subjectRef: {
                            subjectType: 'membership',
                            subjectKey: 'membership-black-001',
                        },
                        usedQuantity: 2,
                        source: 'orderFact',
                        factRef: 'order-fact-001',
                        occurredAt: '2026-04-30T00:00:00.000Z',
                    },
                ],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-daily-quota'},
                availability: 'unavailable',
                unavailableReason: {
                    code: 'quotaExhausted',
                    bucketKey: 'black-card-daily-8-off',
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
    })

    it('G19 requires matching active membership before applying member-only benefits', () => {
        const template = {
            ...amountOffTemplate('tmpl-black-card-only'),
            eligibilityPolicy: {
                ...amountOffTemplate().eligibilityPolicy,
                membershipRequirements: [
                    {
                        membershipType: 'mall.black-card',
                        levelCodes: ['BLACK'],
                    },
                ],
            },
        } satisfies BenefitTemplate

        const withoutIdentity = evaluateBenefitRequest(requestOf(template, [baseLine('1', 12000)]))
        expect(withoutIdentity.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'eligibilityNotMet',
                    failedRequirements: ['membershipRequirements'],
                },
            },
        ])
        expect(withoutIdentity.applications).toHaveLength(0)

        const withIdentity = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            identitySnapshot: mallBlackCardIdentity(),
        })
        expect(withIdentity.opportunities).toMatchObject([
            {
                availability: 'available',
            },
        ])
        expect(withIdentity.pricingAdjustments).toMatchObject([
            {
                amount: money(2000),
                targetLineIds: ['1'],
            },
        ])
    })

    it('G20 limits pricing adjustments to commerce lines matched by template product scope', () => {
        const template = {
            ...amountOffTemplate('tmpl-sku-target-only'),
            eligibilityPolicy: {
                ...amountOffTemplate().eligibilityPolicy,
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'skuId', values: ['sku-target']}],
                },
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(
            requestOf(template, [
                scopedLine('target', 12000, 'sku-target'),
                scopedLine('other', 8000, 'sku-other'),
            ]),
        )

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(2000),
                targetLineIds: ['target'],
            },
        ])
        expect(result.allocations.map((allocation) => allocation.targetLineId)).toEqual(['target'])
    })

    it('G21 evaluates amount thresholds against product-scoped commerce lines', () => {
        const template = {
            ...amountOffTemplate('tmpl-sku-threshold'),
            eligibilityPolicy: {
                ...amountOffTemplate().eligibilityPolicy,
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'skuId', values: ['sku-target']}],
                },
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(
            requestOf(template, [
                scopedLine('target', 8000, 'sku-target'),
                scopedLine('other', 12000, 'sku-other'),
            ]),
        )

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'thresholdNotMet',
                    required: money(10000),
                    current: money(8000),
                },
            },
        ])
        expect(result.pricingAdjustments).toHaveLength(0)
    })

    it('G22 surfaces consumed personal benefit lines as unavailable instead of falling back to template activity', () => {
        const template = {
            ...amountOffTemplate('tmpl-consumed-coupon'),
            selectionPolicy: {
                mode: 'manual' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [
                    {
                        lineKey: 'coupon-line-consumed',
                        templateKey: 'tmpl-consumed-coupon',
                        lineType: 'asset',
                        quantity: 1,
                        status: 'consumed',
                    },
                ],
                reservations: [],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-consumed-coupon',
                    lineKey: 'coupon-line-consumed',
                },
                availability: 'unavailable',
                unavailableReason: {
                    code: 'lineConsumed',
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
    })

    it('G24 treats expired benefit line availability windows as unavailable', () => {
        const template = {
            ...amountOffTemplate('tmpl-expired-coupon'),
            selectionPolicy: {
                mode: 'manual' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [
                    {
                        lineKey: 'coupon-line-expired',
                        templateKey: 'tmpl-expired-coupon',
                        lineType: 'asset',
                        quantity: 1,
                        status: 'available',
                        availableTo: '2000-01-01T00:00:00.000Z',
                    },
                ],
                reservations: [],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'lineExpired',
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
    })

    it('G25 checks minimum payable amount against remaining payable after completed settlements', () => {
        const template = {
            ...amountOffTemplate('tmpl-minimum-remaining-payable'),
            eligibilityPolicy: {
                minimumPayableAmount: money(10000),
            },
            selectionPolicy: {
                mode: 'manual' as const,
            },
        } satisfies BenefitTemplate
        const request = requestOf(template, [baseLine('1', 12000)])

        const result = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                completedSettlements: [
                    {
                        settlementLineId: 'coupon-7000',
                        lineType: 'coupon_deduction',
                        coverageAmount: money(7000),
                        payableImpactAmount: money(7000),
                        completedAt: '2026-04-30T00:00:00.000Z',
                        status: 'completed',
                    },
                ],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'thresholdNotMet',
                    required: money(10000),
                    current: money(5000),
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
    })

    it('G26 only counts quota facts for the matching reservation subject when identity is known', () => {
        const template = {
            ...amountOffTemplate('tmpl-member-quota-scoped'),
            eligibilityPolicy: {
                ...amountOffTemplate().eligibilityPolicy,
                membershipRequirements: [
                    {
                        membershipType: 'mall.black-card',
                        levelCodes: ['BLACK'],
                    },
                ],
            },
            reservationPolicy: {
                mode: 'autoOnOpportunity' as const,
                subject: 'membership' as const,
                subjectMembershipType: 'mall.black-card',
                quotaBucket: {
                    bucketKey: 'black-card-daily-8-off',
                    window: 'perDay' as const,
                    limitQuantity: 1,
                    factSources: ['orderFact' as const],
                },
                releaseOn: ['cartCanceled' as const],
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            identitySnapshot: mallBlackCardIdentity('membership-black-002'),
            benefitSnapshot: {
                templates: [template],
                lines: [],
                reservations: [],
                quotaFacts: [
                    {
                        bucketKey: 'black-card-daily-8-off',
                        subjectRef: {
                            subjectType: 'membership',
                            subjectKey: 'membership-black-001',
                        },
                        usedQuantity: 1,
                        source: 'orderFact',
                        factRef: 'other-member-order-fact',
                        occurredAt: '2026-04-30T00:00:00.000Z',
                    },
                ],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-member-quota-scoped'},
                availability: 'available',
            },
        ])
        expect(result.applications).toHaveLength(1)
    })

    it('G27 reports stageNotApplicable when a benefit is not configured for the current transaction stage', () => {
        const template = {
            ...amountOffTemplate('tmpl-payment-stage-only'),
            eligibilityPolicy: {
                applicableStages: ['payment' as const],
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 12000)]))

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'stageNotApplicable',
                    applicableStages: ['payment'],
                },
            },
        ])
        expect(result.applications).toHaveLength(0)
    })

    it('G28 applies ratio-off benefits as pricing adjustments', () => {
        const template = {
            ...amountOffTemplate('tmpl-ratio-off'),
            effectPolicy: {
                kind: 'ratioOff' as const,
                discountRatio: 0.2,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 12000)]))

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(2400),
                targetLineIds: ['1'],
                priceEffect: 'ratioOff',
            },
        ])
    })

    it('G29 applies identity-exclusive fixed prices to matched goods only', () => {
        const template = {
            ...amountOffTemplate('tmpl-member-fixed-price'),
            eligibilityPolicy: {
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'skuId', values: ['sku-member-price']}],
                },
            },
            effectPolicy: {
                kind: 'fixedPrice' as const,
                fixedUnitPrice: money(5000),
                priceEffect: 'memberPrice' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(
            requestOf(template, [
                scopedLine('member-price', 8000, 'sku-member-price'),
                scopedLine('normal', 7000, 'sku-normal'),
            ]),
        )

        expect(result.pricingAdjustments).toMatchObject([
            {
                amount: money(3000),
                targetLineIds: ['member-price'],
                priceEffect: 'memberPrice',
            },
        ])
    })

    it('G30 creates a stored value settlement candidate from the remaining payable amount', () => {
        const template = {
            ...amountOffTemplate('tmpl-stored-value-deduction'),
            eligibilityPolicy: {},
            effectPolicy: {
                kind: 'storedValueDeduction' as const,
                maxDeductionAmount: money(9000),
            },
            selectionPolicy: {
                mode: 'manual' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'stored_value_deduction' as const,
                quantityUnit: 'cent' as const,
                amountRole: 'coverageAmount' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate
        const line = {
            lineKey: 'stored-value-account',
            templateKey: 'tmpl-stored-value-deduction',
            lineType: 'account',
            quantity: 12000,
            balanceAmount: money(12000),
            status: 'available',
        } satisfies BenefitLine

        const result = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('1', 12000)]),
            benefitSnapshot: {
                templates: [template],
                lines: [line],
                reservations: [],
            },
            selectedApplications: [
                {
                    benefitRef: {
                        templateKey: 'tmpl-stored-value-deduction',
                        lineKey: 'stored-value-account',
                    },
                },
            ],
        })

        expect(result.settlementLines).toMatchObject([
            {
                benefitRef: {
                    templateKey: 'tmpl-stored-value-deduction',
                    lineKey: 'stored-value-account',
                },
                lineType: 'stored_value_deduction',
                quantity: 9000,
                quantityUnit: 'cent',
                payableImpactAmount: money(9000),
            },
        ])
    })

    it('G31 emits price layer snapshots for line-level price explanations', () => {
        const template = {
            ...amountOffTemplate('tmpl-member-price-layer'),
            eligibilityPolicy: {
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'skuId', values: ['sku-member-price']}],
                },
            },
            effectPolicy: {
                kind: 'fixedPrice' as const,
                fixedUnitPrice: money(7000),
                priceEffect: 'memberPrice' as const,
            },
        } satisfies BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [scopedLine('line-1', 10000, 'sku-member-price')]))

        expect(result.priceLayers).toMatchObject([
            {
                source: 'memberPrice',
                benefitRef: {
                    templateKey: 'tmpl-member-price-layer',
                },
                unitPriceBefore: money(10000),
                unitPriceAfter: money(7000),
                lineAmountBefore: money(10000),
                lineAmountAfter: money(7000),
                adjustmentAmount: money(3000),
            },
        ])
        expect(result.pricingAdjustments).toMatchObject([
            {
                priceLayerIds: [result.priceLayers[0]!.layerId],
            },
        ])
    })

    it('G32 evaluates quantity thresholds from product-scoped lines', () => {
        const template = {
            ...amountOffTemplate('tmpl-quantity-threshold'),
            eligibilityPolicy: {
                thresholdRequirements: [
                    {
                        thresholdType: 'quantity' as const,
                        operator: 'gte' as const,
                        quantity: 3,
                    },
                ],
            },
        } satisfies BenefitTemplate

        const matched = evaluateBenefitRequest({
            ...requestOf(template, [baseLine('qty-line', 12000)]),
            subject: {
                ...requestOf(template, [baseLine('qty-line', 12000)]).subject,
                lines: [
                    {
                        ...baseLine('qty-line', 12000),
                        quantity: 3,
                    },
                ],
            },
        })
        expect(matched.opportunities).toMatchObject([{availability: 'available'}])

        const unmatched = evaluateBenefitRequest(requestOf(template, [baseLine('qty-line', 12000)]))
        expect(unmatched.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'eligibilityNotMet',
                    failedRequirements: ['thresholdRequirements.quantity'],
                },
            },
        ])
    })

    it('G33 checks payment acquiring scope in addition to payment instrument type', () => {
        const template = {
            ...amountOffTemplate('tmpl-acquirer-only'),
            eligibilityPolicy: {
                paymentInstrumentScope: {
                    instrumentTypes: ['bankCard'],
                    acquiringInstitutionCodes: ['ABC'],
                    acquiringProductCodes: ['BLACK'],
                },
            },
            effectPolicy: {
                kind: 'paymentMethodDiscount' as const,
                discountAmount: money(1000),
            },
            selectionPolicy: {
                mode: 'conditional' as const,
            },
            settlementPolicy: {
                createSettlementLineCandidate: true,
                settlementLineType: 'payment_method_discount' as const,
                amountRole: 'payableImpact' as const,
                copySettlementPayload: true,
            },
        } satisfies BenefitTemplate

        const request = requestOf(template, [baseLine('1', 12000)])
        const mismatch = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                paymentInstrument: {
                    instrumentType: 'bankCard',
                    acquiringInstitutionCode: 'ICBC',
                    acquiringProductCode: 'BLACK',
                },
            },
        })
        expect(mismatch.opportunities).toMatchObject([
            {
                availability: 'conditional',
                requiredAction: 'selectPaymentInstrument',
            },
        ])

        const matched = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                paymentInstrument: {
                    instrumentType: 'bankCard',
                    acquiringInstitutionCode: 'ABC',
                    acquiringProductCode: 'BLACK',
                },
            },
            selectedApplications: [{benefitRef: {templateKey: 'tmpl-acquirer-only'}}],
        })
        expect(matched.settlementLines).toMatchObject([
            {
                lineType: 'stored_value_deduction',
                payableImpactAmount: money(11000),
            },
            {
                lineType: 'payment_method_discount',
                payableImpactAmount: money(1000),
            },
        ])
    })

    it('G34 evaluates thresholds after completed pricing settlements when configured', () => {
        const template = {
            ...amountOffTemplate('tmpl-after-pricing-threshold'),
            basisPolicy: {
                ...amountOffTemplate().basisPolicy,
                thresholdBase: 'afterSelectedPricingAdjustments' as const,
            },
            eligibilityPolicy: {
                thresholdRequirements: [
                    {
                        thresholdType: 'amount' as const,
                        operator: 'gte' as const,
                        amount: money(10000),
                    },
                ],
            },
        } satisfies BenefitTemplate
        const request = requestOf(template, [baseLine('1', 12000)])

        const result = evaluateBenefitRequest({
            ...request,
            subject: {
                ...request.subject,
                completedSettlements: [
                    {
                        settlementLineId: 'pricing-3000',
                        lineType: 'pricing_adjustment_record',
                        coverageAmount: money(3000),
                        payableImpactAmount: money(3000),
                        completedAt: '2026-04-30T00:00:00.000Z',
                        status: 'completed',
                    },
                ],
            },
        })

        expect(result.opportunities).toMatchObject([
            {
                availability: 'unavailable',
                unavailableReason: {
                    code: 'thresholdNotMet',
                    required: money(10000),
                    current: money(9000),
                },
            },
        ])
    })

    it('G35 matches product scope by category path and sale product type identities', () => {
        const categoryTemplate = {
            ...amountOffTemplate('tmpl-category-scope'),
            eligibilityPolicy: {
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'categoryId', values: ['cat-skin-care'], ownerScope: 'store-001'}],
                },
            },
        } satisfies BenefitTemplate
        const typeTemplate = {
            ...amountOffTemplate('tmpl-sale-type-scope'),
            eligibilityPolicy: {
                productScope: {
                    mode: 'include' as const,
                    identityMatchers: [{identityType: 'saleProductType', values: ['luxury-cosmetic']}],
                },
            },
        } satisfies BenefitTemplate

        const categoryResult = evaluateBenefitRequest(
            requestOf(categoryTemplate, [
                categoryLine('category-hit', 12000, 'cat-skin-care'),
                categoryLine('category-miss', 12000, 'cat-fragrance'),
            ]),
        )
        expect(categoryResult.pricingAdjustments).toMatchObject([
            {
                targetLineIds: ['category-hit'],
            },
        ])

        const typeResult = evaluateBenefitRequest(
            requestOf(typeTemplate, [
                categoryLine('type-hit', 12000, 'cat-a', 'luxury-cosmetic'),
                categoryLine('type-miss', 12000, 'cat-b', 'daily-cosmetic'),
            ]),
        )
        expect(typeResult.pricingAdjustments).toMatchObject([
            {
                targetLineIds: ['type-hit'],
            },
        ])
    })

    it('G23 returns unsupported diagnostic for unknown effect kind without throwing', () => {
        const template = {
            ...amountOffTemplate('tmpl-unknown'),
            effectPolicy: {
                kind: 'futureEffect',
            },
        } as unknown as BenefitTemplate

        const result = evaluateBenefitRequest(requestOf(template, [baseLine('1', 12000)]))

        expect(result.diagnostics).toMatchObject([
            {
                code: 'unsupportedEffectKind',
                benefitRef: {templateKey: 'tmpl-unknown'},
            },
        ])
    })
})
