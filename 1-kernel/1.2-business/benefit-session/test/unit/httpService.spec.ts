import {describe, expect, it} from 'vitest'
import {createLoggerPort} from '@next/kernel-base-platform-ports'
import {
    createHttpRuntime,
    type HttpSuccessResponse,
    type HttpTransport,
    type HttpTransportRequest,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {
    createBenefitSessionHttpService,
    createBenefitSessionModule,
    type BenefitCenterPort,
} from '../../src'

const createTestLogger = () => createLoggerPort({
    environmentMode: 'DEV',
    write: () => {},
    scope: {
        moduleName: 'kernel.business.benefit-session.test',
        layer: 'kernel',
    },
})

const toSuccessResponse = <TResponse>(
    data: TResponse,
    status = 200,
    statusText = 'OK',
): HttpSuccessResponse<TResponse> => ({
    data,
    status,
    statusText,
    headers: {},
})

const createBenefitCenterPortFromTransport = (transport: HttpTransport) => createBenefitSessionHttpService(createHttpRuntime({
    logger: createTestLogger(),
    transport,
    servers: [
        {
            serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
            addresses: [
                {
                    addressName: 'unit',
                    baseUrl: 'http://benefit-center.test',
                },
            ],
        },
    ],
}))

describe('benefit session http service', () => {
    it('maps benefit center port calls to transport-runtime endpoints', async () => {
        const requests: HttpTransportRequest<any, any, any>[] = []
        const transport: HttpTransport = {
            async execute(request) {
                requests.push(request)
                switch (request.endpoint.name) {
                    case 'kernel.business.benefit-session.query-personal-benefits':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/personal-query')
                        expect(request.input.body).toMatchObject({
                            terminalNo: 'TERM-001',
                            entryIdentity: {identityType: 'mallMemberCard', identityValue: 'MALL-BLACK-001'},
                        })
                        return toSuccessResponse({
                            success: true,
                            data: {
                                identitySnapshot: {
                                    entryIdentity: (request.input.body as any).entryIdentity,
                                    identities: [],
                                },
                                benefitSnapshot: {
                                    templates: [],
                                    lines: [],
                                    reservations: [],
                                },
                            },
                        } as any)
                    case 'kernel.business.benefit-session.reserve-benefit':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/reservations')
                        return toSuccessResponse({
                            success: true,
                            data: {
                                reservationId: 'reservation-001',
                                state: 'held_by_cart',
                                createdAt: '2026-04-30T00:00:00.000Z',
                                updatedAt: '2026-04-30T00:00:00.000Z',
                                ...(request.input.body as object),
                            },
                        } as any, 201, 'Created')
                    case 'kernel.business.benefit-session.release-benefit-reservation':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/reservations/reservation-001/release')
                        return toSuccessResponse({
                            success: true,
                            data: {
                                reservationId: 'reservation-001',
                                state: 'released',
                                benefitRef: {templateKey: 'tmpl-001'},
                                subjectRef: {subjectType: 'custom', subjectKey: 'subject-001'},
                                contextRef: {contextType: 'cart', contextId: 'cart-A'},
                                quantity: 1,
                                idempotencyKey: 'idem-001',
                                createdAt: '2026-04-30T00:00:00.000Z',
                                updatedAt: '2026-04-30T00:01:00.000Z',
                            },
                        } as any)
                    case 'kernel.business.benefit-session.promote-benefit-reservation':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/reservations/reservation-001/promote')
                        return toSuccessResponse({
                            success: true,
                            data: {
                                reservationId: 'reservation-001',
                                state: 'promoted_to_order',
                                benefitRef: {templateKey: 'tmpl-001'},
                                subjectRef: {subjectType: 'custom', subjectKey: 'subject-001'},
                                contextRef: {contextType: 'cart', contextId: 'cart-A'},
                                quantity: 1,
                                idempotencyKey: 'idem-001',
                                createdAt: '2026-04-30T00:00:00.000Z',
                                updatedAt: '2026-04-30T00:01:00.000Z',
                            },
                        } as any)
                    case 'kernel.business.benefit-session.activate-benefit-code':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/codes/activate')
                        return toSuccessResponse({
                            success: true,
                            data: {
                                activationId: 'activation-PROMO100',
                                contextRef: {contextType: 'cart', contextId: 'cart-A'},
                                code: 'PROMO100',
                                activatedTemplates: [],
                                activatedLines: [],
                                diagnostics: [],
                            },
                        } as any, 201, 'Created')
                    case 'kernel.business.benefit-session.query-order-facts':
                        expect(request.endpoint.method).toBe('GET')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/order-facts?bucketKey=black-card-daily-8-off&subjectType=membership&subjectKey=membership-black-001')
                        return toSuccessResponse({
                            success: true,
                            data: [
                                {
                                    bucketKey: 'black-card-daily-8-off',
                                    subjectRef: {subjectType: 'membership', subjectKey: 'membership-black-001'},
                                    usedQuantity: 1,
                                    source: 'orderFact',
                                },
                            ],
                        } as any)
                    case 'kernel.business.benefit-session.complete-settlement-fact':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/payment-facts/settlements/complete')
                        expect(request.input.body).toMatchObject({
                            settlementLineId: 'settlement-coupon-001',
                            lineType: 'coupon_deduction',
                        })
                        return toSuccessResponse({
                            success: true,
                            data: {
                                settlementLineId: 'settlement-coupon-001',
                                lineType: 'coupon_deduction',
                                coverageAmount: {amount: 10000, currency: 'CNY'},
                                payableImpactAmount: {amount: 10000, currency: 'CNY'},
                                completedAt: '2026-04-30T00:00:00.000Z',
                                status: 'completed',
                            },
                        } as any, 201, 'Created')
                    case 'kernel.business.benefit-session.refund-settlement-fact':
                        expect(request.endpoint.method).toBe('POST')
                        expect(request.url).toBe('http://benefit-center.test/api/commercial-benefit/payment-facts/settlements/settlement-coupon-001/refund')
                        return toSuccessResponse({
                            success: true,
                            data: {
                                settlementLineId: 'settlement-coupon-001',
                                lineType: 'coupon_deduction',
                                coverageAmount: {amount: 10000, currency: 'CNY'},
                                payableImpactAmount: {amount: 10000, currency: 'CNY'},
                                completedAt: '2026-04-30T00:00:00.000Z',
                                status: 'refunded',
                            },
                        } as any)
                    default:
                        throw new Error(`Unexpected endpoint: ${request.endpoint.name}`)
                }
            },
        }

        const benefitCenterPort = createBenefitCenterPortFromTransport(transport)

        const personal = await benefitCenterPort.queryPersonalBenefits({
            terminalNo: 'TERM-001',
            entryIdentity: {identityType: 'mallMemberCard', identityValue: 'MALL-BLACK-001'},
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
        })
        expect(personal.identitySnapshot.entryIdentity.identityValue).toBe('MALL-BLACK-001')

        const reservation = await benefitCenterPort.reserveBenefit({
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            benefitRef: {templateKey: 'tmpl-001'},
            subjectRef: {subjectType: 'custom', subjectKey: 'subject-001'},
            quantity: 1,
            idempotencyKey: 'idem-001',
        })
        expect(reservation.reservationId).toBe('reservation-001')

        await expect(benefitCenterPort.releaseBenefitReservation(reservation)).resolves.toMatchObject({state: 'released'})
        await expect(benefitCenterPort.promoteBenefitReservation?.(reservation)).resolves.toMatchObject({state: 'promoted_to_order'})
        await expect(benefitCenterPort.activateBenefitCode({
            contextRef: {contextType: 'cart', contextId: 'cart-A'},
            code: 'PROMO100',
            idempotencyKey: 'PROMO100:cart-A',
        })).resolves.toMatchObject({activationId: 'activation-PROMO100'})
        await expect(benefitCenterPort.queryOrderFacts?.({
            bucketKey: 'black-card-daily-8-off',
            subjectType: 'membership',
            subjectKey: 'membership-black-001',
        })).resolves.toEqual([
            expect.objectContaining({
                bucketKey: 'black-card-daily-8-off',
                usedQuantity: 1,
            }),
        ])
        await expect(benefitCenterPort.completeSettlementFact?.({
            settlementLineId: 'settlement-coupon-001',
            lineType: 'coupon_deduction',
            coverageAmount: {amount: 10000, currency: 'CNY'},
            payableImpactAmount: {amount: 10000, currency: 'CNY'},
            completedAt: '2026-04-30T00:00:00.000Z',
        })).resolves.toMatchObject({status: 'completed'})
        await expect(benefitCenterPort.markSettlementFact?.('settlement-coupon-001', 'refunded'))
            .resolves.toMatchObject({status: 'refunded'})

        expect(requests.map(request => request.endpoint.name)).toEqual([
            'kernel.business.benefit-session.query-personal-benefits',
            'kernel.business.benefit-session.reserve-benefit',
            'kernel.business.benefit-session.release-benefit-reservation',
            'kernel.business.benefit-session.promote-benefit-reservation',
            'kernel.business.benefit-session.activate-benefit-code',
            'kernel.business.benefit-session.query-order-facts',
            'kernel.business.benefit-session.complete-settlement-fact',
            'kernel.business.benefit-session.refund-settlement-fact',
        ])
    })

    it('throws a module AppError when the commercial benefit API rejects a request', async () => {
        const benefitCenterPort = createBenefitCenterPortFromTransport({
            async execute() {
                return toSuccessResponse({
                    success: false,
                    data: undefined,
                    error: {message: 'ENTRY_IDENTITY_REQUIRED'},
                } as any, 400, 'Bad Request')
            },
        })

        await expect(benefitCenterPort.queryPersonalBenefits({
            terminalNo: 'TERM-001',
            entryIdentity: {identityType: '', identityValue: ''},
        })).rejects.toMatchObject({
            key: 'kernel.business.benefit-session.benefit_center_request_failed',
            message: 'Benefit center request failed: ENTRY_IDENTITY_REQUIRED',
        })
    })

    it('rejects ambiguous direct port and http runtime assembly configuration', () => {
        const benefitCenterPort = {
            queryPersonalBenefits: async () => ({
                identitySnapshot: {
                    entryIdentity: {identityType: 'stub', identityValue: 'stub'},
                    identities: [],
                },
                benefitSnapshot: {
                    templates: [],
                    lines: [],
                    reservations: [],
                },
            }),
            reserveBenefit: async input => ({
                reservationId: 'stub-reservation',
                benefitRef: input.benefitRef,
                subjectRef: input.subjectRef,
                contextRef: input.contextRef,
                quantity: input.quantity,
                state: 'held_by_cart',
                idempotencyKey: input.idempotencyKey,
                createdAt: '2026-04-30T00:00:00.000Z',
                updatedAt: '2026-04-30T00:00:00.000Z',
            }),
            releaseBenefitReservation: async reservation => ({
                ...reservation,
                state: 'released',
            }),
            activateBenefitCode: async input => ({
                activationId: `stub-${input.code}`,
                contextRef: input.contextRef,
                code: input.code,
                activatedTemplates: [],
                activatedLines: [],
                diagnostics: [],
            }),
        } satisfies BenefitCenterPort

        expect(() => createBenefitSessionModule({
            benefitCenterPort,
            assembly: {
                createHttpRuntime() {
                    return createHttpRuntime({
                        logger: createTestLogger(),
                        transport: {
                            async execute() {
                                return toSuccessResponse({success: true, data: undefined} as any)
                            },
                        },
                        servers: [],
                    })
                },
            },
        })).toThrow('BENEFIT_SESSION_BENEFIT_CENTER_PORT_CONFLICTS_WITH_ASSEMBLY_HTTP_RUNTIME')
    })
})
