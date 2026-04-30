import {afterEach, describe, expect, it} from 'vitest'
import {
    benefitSessionCommandDefinitions,
    createBenefitSessionHttpService,
    createBenefitSessionModule,
    selectBenefitContextView,
} from '../../src'
import {createLoggerPort} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createFetchHttpTransport,
    createHttpRuntime,
    type HttpRuntime,
} from '@next/kernel-base-transport-runtime'
import {SERVER_NAME_MOCK_TERMINAL_PLATFORM} from '@next/kernel-server-config-v2'
import {createMockTerminalPlatformTestServer} from '../../../../../0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer'
import {createFakeCartSubject, money} from '../harness/createFakeCartSubject'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()))
})

const createBenefitTestHttpRuntime = (
    baseUrl: string,
    context?: RuntimeModuleContextV2,
): HttpRuntime => createHttpRuntime({
    logger: (context?.platformPorts.logger ?? createLoggerPort({
        environmentMode: 'DEV',
        write: () => {},
        scope: {
            moduleName: 'kernel.business.benefit-session.test',
            layer: 'kernel',
        },
    })).scope({
        subsystem: 'transport.http',
        component: 'BenefitSessionHttpServiceMockServerSpec',
    }),
    transport: createFetchHttpTransport(),
    servers: [
        {
            serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
            addresses: [
                {
                    addressName: 'mock-server',
                    baseUrl,
                },
            ],
        },
    ],
})

describe('benefit session http service against mock benefit center', () => {
    it('queries identity, reserves benefits, releases reservations, and activates dynamic codes', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const benefitCenterPort = createBenefitSessionHttpService(createBenefitTestHttpRuntime(server.getHttpBaseUrl()))

        const personal = await benefitCenterPort.queryPersonalBenefits({
            terminalNo: 'TERM-MIXC-SZ-UNI-001',
            entryIdentity: {
                identityType: 'mallMemberCard',
                identityValue: 'MALL-BLACK-001',
            },
            contextRef: {contextType: 'cart', contextId: 'cart-http'},
        })
        expect(personal.identitySnapshot.identities[0]?.memberships[0]).toMatchObject({
            membershipType: 'mall.black-card',
        })
        expect(personal.benefitSnapshot.templates.map(template => template.templateKey)).toContain('tmpl-black-card-daily-8-off')

        const reservation = await benefitCenterPort.reserveBenefit({
            contextRef: {contextType: 'cart', contextId: 'cart-http'},
            benefitRef: {templateKey: 'tmpl-black-card-daily-8-off'},
            subjectRef: {subjectType: 'membership', subjectKey: 'membership-black-001'},
            quantity: 1,
            idempotencyKey: 'http-service-reservation',
        })
        expect(reservation.state).toBe('held_by_cart')

        await expect(benefitCenterPort.promoteBenefitReservation?.(reservation)).resolves.toMatchObject({
            state: 'promoted_to_order',
        })
        await expect(benefitCenterPort.releaseBenefitReservation(reservation)).resolves.toMatchObject({
            state: 'released',
        })

        const activation = await benefitCenterPort.activateBenefitCode({
            contextRef: {contextType: 'cart', contextId: 'cart-http'},
            code: 'PROMO100',
            codeType: 'promotionCode',
            idempotencyKey: 'PROMO100:cart-http',
        })
        expect(activation).toMatchObject({
            code: 'PROMO100',
            activatedTemplates: [
                {
                    templateKey: 'code-template-PROMO100',
                },
            ],
        })

        await expect(benefitCenterPort.queryOrderFacts?.({
            bucketKey: 'black-card-daily-8-off',
            subjectType: 'membership',
            subjectKey: 'membership-black-001',
        })).resolves.toEqual([
            expect.objectContaining({
                bucketKey: 'black-card-daily-8-off',
                source: 'orderFact',
            }),
        ])

        const completed = await benefitCenterPort.completeSettlementFact?.({
            settlementLineId: 'settlement-http-coupon-001',
            lineType: 'coupon_deduction',
            coverageAmount: money(10000),
            payableImpactAmount: money(10000),
            completedAt: '2026-04-30T00:00:00.000Z',
        })
        expect(completed).toMatchObject({
            settlementLineId: 'settlement-http-coupon-001',
            status: 'completed',
        })

        await expect(benefitCenterPort.markSettlementFact?.('settlement-http-coupon-001', 'voided'))
            .resolves.toMatchObject({status: 'voided'})
    })

    it('runs session commands through the injected http runtime against the mock benefit center', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const runtime = createKernelRuntimeV2({
            modules: [
                createBenefitSessionModule({
                    assembly: {
                        createHttpRuntime(context) {
                            return createBenefitTestHttpRuntime(server.getHttpBaseUrl(), context)
                        },
                    },
                }),
            ],
        })
        await runtime.start()

        const contextRef = {contextType: 'cart' as const, contextId: 'cart-http-session', isCurrent: true}
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.linkBenefitIdentity, {
            contextRef,
            terminalNo: 'TERM-MIXC-SZ-UNI-001',
            entryIdentity: {
                identityType: 'mallMemberCard',
                identityValue: 'MALL-BLACK-001',
            },
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef,
            stage: 'cart',
            subject: createFakeCartSubject({
                lines: [
                    {
                        lineId: 'beauty-1',
                        skuId: 'beauty-sku-001',
                        unitPrice: 12000,
                    },
                ],
            }),
        }))

        const afterIdentity = selectBenefitContextView(runtime.getState(), contextRef)
        expect(afterIdentity.identitySnapshot?.identities[0]?.memberships[0]).toMatchObject({
            membershipType: 'mall.black-card',
        })
        expect(afterIdentity.result?.opportunities.some(item => item.benefitRef.templateKey === 'tmpl-coupon-100-off')).toBe(true)

        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.activateBenefitCode, {
            contextRef,
            code: 'PROMO100',
            codeType: 'promotionCode',
            idempotencyKey: 'PROMO100:cart-http-session',
        }))
        await runtime.dispatchCommand(createCommand(benefitSessionCommandDefinitions.evaluateBenefitContext, {
            contextRef,
            stage: 'cart',
            subject: createFakeCartSubject({
                lines: [
                    {
                        lineId: 'beauty-1',
                        skuId: 'beauty-sku-001',
                        unitPrice: 12000,
                    },
                ],
            }),
        }))

        expect(selectBenefitContextView(runtime.getState(), contextRef).result?.pricingAdjustments).toContainEqual(
            expect.objectContaining({
                benefitRef: {templateKey: 'code-template-PROMO100'},
                amount: money(1000),
            }),
        )
    })
})
