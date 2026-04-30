import {describe, expect, it, vi} from 'vitest'
import {
    createCommand,
    createKernelRuntimeV2,
} from '@next/kernel-base-runtime-shell-v2'
import {tdpSyncV2CommandDefinitions} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    benefitSessionCommandDefinitions,
    createBenefitSessionModule,
    selectBenefitApplications,
    selectBenefitContextView,
    selectBenefitOpportunities,
    selectBenefitReservations,
    type BenefitCenterPort,
} from '../../src'
import type {
    ActivatedBenefitCodeResult,
    BenefitEvaluationRequest,
    BenefitEvaluationResult,
    BenefitLine,
    BenefitTemplate,
    CommerceLineSnapshot,
    CommerceSubjectSnapshot,
    CustomerIdentitySnapshot,
    Money,
} from '@next/kernel-business-benefit-types'

const money = (amount: number): Money => ({amount, currency: 'CNY'})

const line = (lineId: string, amount: number): CommerceLineSnapshot => ({
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

const subject = (amount: number): CommerceSubjectSnapshot => ({
    terminalNo: 'TERM-001',
    currency: 'CNY',
    lines: [line('1', amount)],
    totals: {
        originalAmount: money(amount),
        currentAmount: money(amount),
        payableAmount: money(amount),
    },
})

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
        ttlSeconds: 7200,
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

const couponLine = (): BenefitLine => ({
    lineKey: 'coupon-line-100-off',
    templateKey: 'tmpl-coupon-100-off',
    lineType: 'asset',
    ownerIdentityKey: 'identity-mall-member-001',
    quantity: 1,
    status: 'available',
})

const pointsLine = (): BenefitLine => ({
    lineKey: 'points-account',
    templateKey: 'tmpl-points',
    lineType: 'account',
    ownerIdentityKey: 'identity-mall-member-001',
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

const createRuntime = (benefitCenterPortOverride?: Partial<BenefitCenterPort>) => {
    const fullBenefitCenterPort: BenefitCenterPort = {
        queryPersonalBenefits: vi.fn(async () => ({
            identitySnapshot: identitySnapshot(),
            benefitSnapshot: {
                templates: [couponTemplate(), pointsTemplate()],
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
            state: input.contextRef.contextType === 'payment' ? 'held_by_payment' : 'held_by_cart',
            idempotencyKey: input.idempotencyKey,
            createdAt: '2026-04-30T00:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
        })),
        releaseBenefitReservation: vi.fn(async reservation => ({
            ...reservation,
            state: 'released',
            updatedAt: '2026-04-30T00:01:00.000Z',
        })),
        promoteBenefitReservation: vi.fn(async reservation => reservation),
        activateBenefitCode: vi.fn(async input => ({
            activationId: `activation-${input.code}`,
            contextRef: input.contextRef,
            code: input.code,
            activatedTemplates: [couponTemplate()],
            activatedLines: [{
                ...couponLine(),
                lineKey: `code-line-${input.code}`,
            }],
            diagnostics: [],
        } satisfies ActivatedBenefitCodeResult)),
        ...benefitCenterPortOverride,
    }

    return {
        benefitCenterPort: fullBenefitCenterPort,
        runtime: createKernelRuntimeV2({
            modules: [createBenefitSessionModule({benefitCenterPort: fullBenefitCenterPort})],
        }),
    }
}

describe('benefit session evaluation', () => {
    it('reuses the cached evaluation when the context input has not changed', async () => {
        const calculator = {
            evaluateBenefitRequest: vi.fn((request: BenefitEvaluationRequest): BenefitEvaluationResult => ({
                contextRef: request.contextRef,
                stage: request.stage,
                opportunities: [],
                prompts: [],
                applications: [],
                pricingAdjustments: [],
                fulfillmentEffects: [],
                settlementGroups: [],
                settlementLines: [],
                allocations: [],
                diagnostics: [],
            })),
        }
        const runtime = createKernelRuntimeV2({
            modules: [createBenefitSessionModule({calculator})],
        })
        await runtime.start()

        const payload = {
            contextRef: {contextType: 'cart' as const, contextId: 'cart-cache', isCurrent: true},
            stage: 'cart' as const,
            subject: subject(12000),
        }
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, payload))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, payload))

        expect(calculator.evaluateBenefitRequest).toHaveBeenCalledTimes(1)
    })

    it('loads TDP benefit templates into the session snapshot and evaluates without personal identity', async () => {
        const {runtime} = createRuntime()
        await runtime.start()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
            topic: 'commercial.benefit-template.profile',
            changes: [
                {
                    operation: 'upsert',
                    itemKey: 'tmpl-tdp-full-reduction',
                    revision: 1,
                    scopeType: 'STORE',
                    scopeId: 'store-001',
                    payload: baseTemplate('tmpl-tdp-full-reduction') as unknown as Record<string, unknown>,
                    occurredAt: '2026-04-30T00:00:00.000Z',
                },
            ],
        }))

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {
                contextType: 'cart',
                contextId: 'cart-tdp',
                isCurrent: true,
            },
            stage: 'cart',
            subject: subject(12000),
        }))

        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'cart-tdp'})).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-tdp-full-reduction'},
                availability: 'available',
            },
        ])
        expect(selectBenefitApplications(runtime.getState(), {contextType: 'cart', contextId: 'cart-tdp'})).toHaveLength(1)
    })

    it('queries personal benefits, merges identity and benefit snapshot, and selects manual benefits', async () => {
        const {runtime, benefitCenterPort} = createRuntime()
        await runtime.start()

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.linkBenefitIdentity, {
            contextRef: {contextType: 'cart', contextId: 'cart-personal'},
            terminalNo: 'TERM-001',
            entryIdentity: {
                identityType: 'mallMemberCard',
                identityValue: 'MALL-BLACK-001',
            },
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-personal', isCurrent: true},
            stage: 'cart',
            subject: subject(20000),
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.selectBenefitOpportunity, {
            contextRef: {contextType: 'cart', contextId: 'cart-personal'},
            opportunityId: 'opp-tmpl-coupon-100-off-coupon-line-100-off',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-personal', isCurrent: true},
            stage: 'cart',
            subject: subject(20000),
        }))

        const view = selectBenefitContextView(runtime.getState(), {contextType: 'cart', contextId: 'cart-personal'})

        expect(benefitCenterPort.queryPersonalBenefits).toHaveBeenCalledTimes(1)
        expect(view.identitySnapshot?.identities[0]?.memberships[0]?.levelCode).toBe('BLACK')
        expect(view.result?.settlementLines).toMatchObject([
            {
                lineType: 'coupon_deduction',
                payableImpactAmount: money(10000),
            },
        ])
    })

    it('reserves an auto opportunity for cart A, makes cart B unavailable, then releases A for B', async () => {
        const {runtime} = createRuntime()
        await runtime.start()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, {
            topic: 'commercial.benefit-template.profile',
            changes: [{
                operation: 'upsert',
                itemKey: 'tmpl-black-card-daily-8-off',
                revision: 1,
                scopeType: 'STORE',
                scopeId: 'store-001',
                payload: blackCardTemplate() as unknown as Record<string, unknown>,
                occurredAt: '2026-04-30T00:00:00.000Z',
            }],
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.linkBenefitIdentity, {
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            terminalNo: 'TERM-001',
            entryIdentity: {identityType: 'mallMemberCard', identityValue: 'MALL-BLACK-001'},
        }))

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-A', isCurrent: true},
            stage: 'cart',
            subject: subject(10000),
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-B', isCurrent: true},
            stage: 'cart',
            subject: subject(10000),
        }))

        expect(selectBenefitReservations(runtime.getState(), {contextType: 'cart', contextId: 'cart-A'})).toMatchObject([
            {
                benefitRef: {templateKey: 'tmpl-black-card-daily-8-off'},
                state: 'held_by_cart',
            },
        ])
        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'cart-B'})
            .find(item => item.benefitRef.templateKey === 'tmpl-black-card-daily-8-off'))
            .toMatchObject({
                availability: 'unavailable',
                unavailableReason: {
                    code: 'reservedByOtherContext',
                    contextRef: {
                        contextId: 'cart-A',
                    },
                },
            })

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.releaseBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            reason: 'cartCanceled',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'cart', contextId: 'cart-B', isCurrent: true},
            stage: 'cart',
            subject: subject(10000),
        }))

        expect(selectBenefitOpportunities(runtime.getState(), {contextType: 'cart', contextId: 'cart-B'})
            .find(item => item.benefitRef.templateKey === 'tmpl-black-card-daily-8-off'))
            .toMatchObject({
                availability: 'available',
            })
    })

    it('adds dynamic code benefits to one context and recalculates completed settlement facts', async () => {
        const paymentDiscount = {
            ...baseTemplate('tmpl-prepaid-discount'),
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
        const {runtime, benefitCenterPort} = createRuntime({
            activateBenefitCode: vi.fn(async input => ({
                activationId: `activation-${input.code}`,
                contextRef: input.contextRef,
                code: input.code,
                activatedTemplates: [paymentDiscount],
                activatedLines: [],
                diagnostics: [],
            })),
        })
        await runtime.start()

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.activateBenefitCode, {
            contextRef: {contextType: 'order', contextId: 'order-001'},
            code: 'PAY20',
            idempotencyKey: 'code-PAY20-order-001',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef: {contextType: 'order', contextId: 'order-001', isCurrent: true},
            stage: 'payment',
            subject: {
                ...subject(30000),
                paymentInstrument: {instrumentType: 'prepaidCard'},
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
            selectedApplications: [{benefitRef: {templateKey: 'tmpl-prepaid-discount'}}],
        }))

        const result = selectBenefitContextView(runtime.getState(), {contextType: 'order', contextId: 'order-001'})
            .result as BenefitEvaluationResult
        expect(benefitCenterPort.activateBenefitCode).toHaveBeenCalledTimes(1)
        expect(result.settlementGroups).toMatchObject([
            {
                coverageAmount: money(5000),
                externalRequestAmount: money(4000),
            },
        ])
    })
})
