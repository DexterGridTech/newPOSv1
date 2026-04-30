import {describe, expect, it, vi} from 'vitest'
import {
    createCommand,
    createKernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    benefitSessionCommandDefinitions,
    createBenefitSessionModule,
    selectBenefitContextView,
    selectBenefitOpportunities,
    type BenefitCenterPort,
} from '../../src'
import type {
    ActivatedBenefitCodeResult,
    BenefitLine,
    BenefitTemplate,
    CustomerIdentitySnapshot,
} from '@next/kernel-business-benefit-types'
import {createFakeCartSubject, money} from './createFakeCartSubject'
import {createFakeOrderSubject} from './createFakeOrderSubject'
import {createFakePaymentSubject} from './createFakePaymentSubject'

const baseTemplate = (templateKey: string): BenefitTemplate => ({
    templateKey,
    templateCode: templateKey.toUpperCase(),
    version: 1,
    status: 'active',
    calculationSchemaVersion: 1,
    eligibilityPolicy: {},
    effectPolicy: {
        kind: 'amountOff',
        amount: money(1000),
    },
    basisPolicy: {
        thresholdBase: 'currentRemainingAmount',
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

const fullReductionTemplate = (): BenefitTemplate => ({
    ...baseTemplate('tmpl-store-full-reduction'),
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
})

const blackCardTemplate = (): BenefitTemplate => ({
    ...baseTemplate('tmpl-black-card-daily-8-off'),
    effectPolicy: {
        kind: 'ratioOff',
        discountRatio: 0.2,
    },
    selectionPolicy: {
        mode: 'auto',
        trigger: 'identityLinked',
    },
    reservationPolicy: {
        mode: 'autoOnOpportunity',
        subject: 'membership',
        subjectMembershipType: 'mall.black-card',
        quotaBucket: {
            bucketKey: 'black-card-daily-8-off',
            window: 'perDay',
            limitQuantity: 1,
            factSources: ['reservationLedger', 'orderFact'],
        },
        releaseOn: ['cartCanceled', 'orderCanceled', 'paymentTimeout', 'identityChanged'],
    },
})

const couponTemplate = (): BenefitTemplate => ({
    ...baseTemplate('tmpl-coupon-100-off'),
    effectPolicy: {
        kind: 'amountOff',
        amount: money(10000),
    },
    selectionPolicy: {
        mode: 'manual',
    },
    reservationPolicy: {
        mode: 'onSelection',
        subject: 'benefitLine',
        releaseOn: ['cartCanceled', 'orderCanceled', 'paymentTimeout', 'benefitRemoved'],
    },
    settlementPolicy: {
        createSettlementLineCandidate: true,
        settlementLineType: 'coupon_deduction',
        quantityUnit: 'piece',
        amountRole: 'payableImpact',
        copySettlementPayload: true,
    },
})

const promotionCodeTemplate = (code: string): BenefitTemplate => ({
    ...baseTemplate(`code-template-${code}`),
    templateCode: `CODE_${code}`,
    effectPolicy: {
        kind: 'amountOff',
        amount: money(1000),
    },
    selectionPolicy: {
        mode: 'auto',
        trigger: 'codeActivated',
    },
})

const couponCodeTemplate = (code: string): BenefitTemplate => ({
    ...couponTemplate(),
    templateKey: `code-template-${code}`,
    templateCode: `CODE_${code}`,
    settlementPayload: {
        externalLineNo: code,
    },
})

const couponLine = (lineKey = 'coupon-line-100-off'): BenefitLine => ({
    lineKey,
    templateKey: 'tmpl-coupon-100-off',
    lineType: 'asset',
    status: 'available',
    quantity: 1,
})

const pointsTemplate = (): BenefitTemplate => ({
    ...baseTemplate('tmpl-points'),
    effectPolicy: {
        kind: 'pointsDeduction',
        pointsPerMoneyUnit: 100,
        maxPoints: 5000,
    },
    selectionPolicy: {
        mode: 'manual',
    },
    settlementPolicy: {
        createSettlementLineCandidate: true,
        settlementLineType: 'points_deduction',
        quantityUnit: 'point',
        amountRole: 'payableImpact',
        copySettlementPayload: true,
    },
})

const pointsLine = (): BenefitLine => ({
    lineKey: 'points-account',
    templateKey: 'tmpl-points',
    lineType: 'account',
    quantity: 6000,
    status: 'available',
})

const identitySnapshot = (): CustomerIdentitySnapshot => ({
    entryIdentity: {
        identityType: 'mallMemberCard',
        identityValue: 'MALL-BLACK-001',
    },
    identities: [
        {
            identityKey: 'identity-mall-member-001',
            identityType: 'mallMemberCard',
            identityValue: 'MALL-BLACK-001',
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

const createBenefitCenterPort = (): BenefitCenterPort => ({
    queryPersonalBenefits: vi.fn(async () => ({
        identitySnapshot: identitySnapshot(),
        benefitSnapshot: {
            templates: [blackCardTemplate(), couponTemplate(), pointsTemplate()],
            lines: [couponLine(), pointsLine()],
            reservations: [],
        },
    })),
    reserveBenefit: vi.fn(async input => ({
        reservationId: `reservation-${input.contextRef.contextId}-${input.benefitRef.templateKey}`,
        benefitRef: input.benefitRef,
        subjectRef: input.subjectRef,
        contextRef: input.contextRef,
        quantity: input.quantity,
        amount: input.amount,
        state: 'held_by_cart',
        idempotencyKey: input.idempotencyKey,
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
    })),
    releaseBenefitReservation: vi.fn(async reservation => ({
        ...reservation,
        state: 'released',
        updatedAt: '2026-04-30T00:01:00.000Z',
    })),
    activateBenefitCode: vi.fn(async input => {
        if (input.code.startsWith('PROMO')) {
            return {
                activationId: `activation-${input.code}`,
                contextRef: input.contextRef,
                code: input.code,
                activatedTemplates: [promotionCodeTemplate(input.code)],
                activatedLines: [],
                diagnostics: [],
            } satisfies ActivatedBenefitCodeResult
        }
        return {
            activationId: `activation-${input.code}`,
            contextRef: input.contextRef,
            code: input.code,
            activatedTemplates: [couponCodeTemplate(input.code)],
            activatedLines: [
                {
                    ...couponLine(`code-line-${input.code}`),
                    templateKey: `code-template-${input.code}`,
                },
            ],
            diagnostics: [],
        } satisfies ActivatedBenefitCodeResult
    }),
})

describe('standard transaction benefit integration harness', () => {
    it('supports cart, order, and payment contexts through the standard subject model', async () => {
        const benefitCenterPort = createBenefitCenterPort()
        const runtime = createKernelRuntimeV2({
            modules: [createBenefitSessionModule({benefitCenterPort})],
        })
        await runtime.start()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
            topic: 'commercial.benefit-template.profile',
            changes: [{
                operation: 'upsert',
                itemKey: 'tmpl-store-full-reduction',
                revision: 1,
                scopeType: 'STORE',
                scopeId: 'store-001',
                payload: fullReductionTemplate() as unknown as Record<string, unknown>,
                occurredAt: '2026-04-30T00:00:00.000Z',
            }],
        }))

        const retailCart = createFakeCartSubject({
            lines: [
                {
                    lineId: 'retail-1',
                    skuId: 'retail-sku-001',
                    spuId: 'retail-spu-001',
                    categoryPath: [{categoryId: 'cat-beauty', depth: 1, ownerScope: 'store-001'}],
                    unitPrice: 12000,
                },
            ],
        })
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'retail-cart', isCurrent: true},
            stage: 'cart',
            subject: retailCart,
        }))
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'cart', contextId: 'retail-cart'})
            .result?.pricingAdjustments).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-store-full-reduction'},
                amount: money(2000),
            },
        ])

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.linkBenefitIdentity, {
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            terminalNo: 'TERM-001',
            entryIdentity: {identityType: 'mallMemberCard', identityValue: 'MALL-BLACK-001'},
        }))
        const cateringCart = createFakeCartSubject({
            lines: [
                {
                    lineId: 'catering-1',
                    skuId: 'dish-sku-001',
                    saleProductTypeCode: 'DINING_PRODUCT',
                    unitPrice: 10000,
                },
            ],
        })
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-A', isCurrent: true},
            stage: 'cart',
            subject: cateringCart,
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-B', isCurrent: true},
            stage: 'cart',
            subject: cateringCart,
        }))
        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'cart-B'})
            .find(item => item.benefitRef.templateKey === 'tmpl-black-card-daily-8-off'))
            .toMatchObject({
                availability: 'unavailable',
                unavailableReason: {code: 'reservedByOtherContext'},
            })

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.releaseBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            reason: 'cartCanceled',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-B', isCurrent: true},
            stage: 'cart',
            subject: cateringCart,
        }))
        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'cart-B'})
            .find(item => item.benefitRef.templateKey === 'tmpl-black-card-daily-8-off'))
            .toMatchObject({availability: 'available'})

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.selectBenefitOpportunity, {
            contextRef: {contextType: 'cart', contextId: 'cart-B'},
            opportunityId: 'opp-tmpl-coupon-100-off-coupon-line-100-off',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-B', isCurrent: true},
            stage: 'cart',
            subject: cateringCart,
        }))
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'cart', contextId: 'cart-B'})
            .result?.settlementLines).toContainEqual(expect.objectContaining({
            lineType: 'coupon_deduction',
            payableImpactAmount: money(10000),
        }))

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.activateBenefitCode, {
            contextRef: {contextType: 'cart', contextId: 'promo-code-cart'},
            code: 'PROMO100',
            idempotencyKey: 'PROMO100:promo-code-cart',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'promo-code-cart', isCurrent: true},
            stage: 'cart',
            subject: retailCart,
        }))
        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'promo-code-cart'})
            .some(item => item.benefitRef.templateKey === 'code-template-PROMO100')).toBe(true)
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'cart', contextId: 'promo-code-cart'})
            .result?.pricingAdjustments).toContainEqual(expect.objectContaining({
            benefitRef: {templateKey: 'code-template-PROMO100'},
            amount: money(1000),
        }))
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'cart', contextId: 'promo-code-cart'})
            .result?.priceLayers.length).toBeGreaterThan(0)

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.activateBenefitCode, {
            contextRef: {contextType: 'order', contextId: 'order-code-scan'},
            code: 'ORDER100',
            idempotencyKey: 'ORDER100:order-code-scan',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'order', contextId: 'order-code-scan', isCurrent: true},
            stage: 'orderConfirm',
            subject: createFakeOrderSubject(retailCart),
        }))
        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'order', contextId: 'order-code-scan'})
            .some(item => item.benefitRef.lineKey === 'code-line-ORDER100')).toBe(true)
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.selectBenefitOpportunity, {
            contextRef: {contextType: 'order', contextId: 'order-code-scan'},
            opportunityId: 'opp-code-template-ORDER100-code-line-ORDER100',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'order', contextId: 'order-code-scan', isCurrent: true},
            stage: 'orderConfirm',
            subject: createFakeOrderSubject(retailCart),
        }))
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'order', contextId: 'order-code-scan'})
            .result?.settlementLines).toContainEqual(expect.objectContaining({
            benefitRef: {templateKey: 'code-template-ORDER100', lineKey: 'code-line-ORDER100'},
            lineType: 'coupon_deduction',
        }))

        const highBeautyOrder = createFakeOrderSubject(createFakeCartSubject({
            lines: [{lineId: 'beauty-1', skuId: 'beauty-sku-001', unitPrice: 30000}],
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.selectBenefitOpportunity, {
            contextRef: {contextType: 'payment', contextId: 'payment-points'},
            opportunityId: 'opp-tmpl-points-points-account',
            selectedQuantity: 5000,
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'payment', contextId: 'payment-points', isCurrent: true},
            stage: 'payment',
            subject: createFakePaymentSubject(highBeautyOrder, {
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
            }),
            selectedApplications: [{
                benefitRef: {templateKey: 'tmpl-points', lineKey: 'points-account'},
                selectedQuantity: 5000,
            }],
        }))
        expect(selectBenefitContextView(runtime.getState(), {contextType: 'payment', contextId: 'payment-points'})
            .result?.settlementLines).toContainEqual(expect.objectContaining({
            lineType: 'points_deduction',
            quantity: 5000,
            payableImpactAmount: money(5000),
        }))
    })
})
