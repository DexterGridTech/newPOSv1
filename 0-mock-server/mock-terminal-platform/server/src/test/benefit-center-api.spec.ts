import {afterEach, describe, expect, it} from 'vitest'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

const postJson = async <TResponse>(url: string, body: Record<string, unknown>) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    payload: await response.json() as TResponse,
  }
}

describe('commercial benefit center mock API', () => {
  it('seeds commercial benefit TDP topics in the kernel base test sandbox', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const prepare = await postJson<{
      data: {sandboxId: string}
    }>(`${server.getHttpBaseUrl()}/mock-debug/kernel-base-test/prepare`, {})

    const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/tdp/topics?sandboxId=${prepare.payload.data.sandboxId}`)
    const payload = await response.json() as {
      data: Array<{key: string; deliveryType?: string}>
    }

    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({key: 'commercial.benefit-template.profile', deliveryType: 'projection'}),
        expect.objectContaining({key: 'commercial.benefit-activity.profile', deliveryType: 'projection'}),
      ]),
    )
  })

  it('returns a normalized identity and benefit snapshot for a terminal entry identity', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const response = await postJson<{
      success: boolean
      data: {
        identitySnapshot: {
          entryIdentity: {identityType: string; identityValue: string}
          identities: Array<{identityKey: string; memberships: Array<{membershipType: string; levelCodes?: string[]}>}>
        }
        benefitSnapshot: {
          templates: Array<{templateKey: string}>
          lines: Array<{lineKey: string}>
          quotaFacts: unknown[]
        }
      }
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/personal-query`, {
      terminalNo: 'TERM-MIXC-SZ-UNI-001',
      entryIdentity: {
        identityType: 'mallMemberCard',
        identityValue: 'MALL-BLACK-001',
      },
    })

    expect(response.status).toBe(200)
    expect(response.payload.success).toBe(true)
    expect(response.payload.data.identitySnapshot.identities[0]?.memberships[0]).toMatchObject({
      membershipType: 'mall.black-card',
      levelCodes: ['BLACK'],
    })
    expect(response.payload.data.benefitSnapshot.templates.map(item => item.templateKey)).toContain('tmpl-black-card-daily-8-off')
    expect(response.payload.data.benefitSnapshot.lines.map(item => item.lineKey)).toContain('coupon-line-100-off')
    expect(response.payload.data.benefitSnapshot.quotaFacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucketKey: 'black-card-daily-8-off',
          source: 'orderFact',
        }),
      ]),
    )
  })

  it('returns standardized order quota facts for benefit quota calculation', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const response = await fetch(`${server.getHttpBaseUrl()}/api/commercial-benefit/order-facts?bucketKey=black-card-daily-8-off&subjectType=membership&subjectKey=membership-black-001`)
    const payload = await response.json() as {
      success: boolean
      data: Array<{bucketKey: string; source: string; usedQuantity: number}>
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toEqual([
      expect.objectContaining({
        bucketKey: 'black-card-daily-8-off',
        source: 'orderFact',
        usedQuantity: 1,
      }),
    ])
  })

  it('holds, promotes, and releases reservations without exposing consume', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const create = await postJson<{
      data: {reservationId: string; state: string}
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/reservations`, {
      terminalNo: 'TERM-MIXC-SZ-UNI-001',
      contextRef: {contextType: 'cart', contextId: 'cart-A'},
      benefitRef: {templateKey: 'tmpl-black-card-daily-8-off'},
      subjectRef: {subjectType: 'membership', subjectKey: 'membership-black-001'},
      quantity: 1,
      idempotencyKey: 'reserve-cart-A',
    })
    expect(create.status).toBe(201)
    expect(create.payload.data.state).toBe('held_by_cart')

    const replay = await postJson<{
      data: {reservationId: string; state: string}
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/reservations`, {
      terminalNo: 'TERM-MIXC-SZ-UNI-001',
      contextRef: {contextType: 'cart', contextId: 'cart-A'},
      benefitRef: {templateKey: 'tmpl-black-card-daily-8-off'},
      subjectRef: {subjectType: 'membership', subjectKey: 'membership-black-001'},
      quantity: 1,
      idempotencyKey: 'reserve-cart-A',
    })
    expect(replay.payload.data.reservationId).toBe(create.payload.data.reservationId)

    const promote = await postJson<{
      data: {state: string}
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/reservations/${create.payload.data.reservationId}/promote`, {
      promoteOn: 'orderCreated',
    })
    expect(promote.payload.data.state).toBe('promoted_to_order')

    const release = await postJson<{
      data: {state: string}
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/reservations/${create.payload.data.reservationId}/release`, {
      reason: 'orderCanceled',
    })
    expect(release.payload.data.state).toBe('released')

    const consume = await fetch(`${server.getHttpBaseUrl()}/api/commercial-benefit/reservations/${create.payload.data.reservationId}/consume`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({}),
    })
    expect(consume.status).toBe(404)
  })

  it('records payment facts as completed settlement snapshots', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const complete = await postJson<{
      data: {
        settlementLineId: string
        status: string
        coverageAmount: {amount: number}
      }
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/payment-facts/settlements/complete`, {
      settlementLineId: 'settlement-coupon-001',
      lineType: 'coupon_deduction',
      coverageAmount: {amount: 10000, currency: 'CNY'},
      payableImpactAmount: {amount: 10000, currency: 'CNY'},
      completedAt: '2026-04-30T00:00:00.000Z',
    })

    expect(complete.status).toBe(201)
    expect(complete.payload.data).toMatchObject({
      settlementLineId: 'settlement-coupon-001',
      status: 'completed',
      coverageAmount: {amount: 10000},
    })

    const refund = await postJson<{
      data: {settlementLineId: string; status: string}
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/payment-facts/settlements/settlement-coupon-001/refund`, {
      reason: 'partialRefund',
    })
    expect(refund.payload.data.status).toBe('refunded')
  })

  it('activates promotion and coupon codes as dynamic benefit templates and lines', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const promotion = await postJson<{
      success: boolean
      data: {
        activationId: string
        code: string
        activatedTemplates: Array<{templateKey: string; effectPolicy: {kind: string}}>
        activatedLines: Array<{lineKey: string}>
      }
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/codes/activate`, {
      contextRef: {contextType: 'cart', contextId: 'cart-promo-code'},
      code: 'PROMO100',
      codeType: 'promotionCode',
      idempotencyKey: 'PROMO100:cart-promo-code',
    })

    expect(promotion.status).toBe(201)
    expect(promotion.payload.success).toBe(true)
    expect(promotion.payload.data).toMatchObject({
      code: 'PROMO100',
      activatedTemplates: [
        {
          templateKey: 'code-template-PROMO100',
          effectPolicy: {kind: 'amountOff'},
        },
      ],
      activatedLines: [],
    })

    const coupon = await postJson<{
      data: {
        activationId: string
        activatedTemplates: Array<{templateKey: string; settlementPolicy: {settlementLineType: string}}>
        activatedLines: Array<{lineKey: string; lineType: string; status: string}>
      }
    }>(`${server.getHttpBaseUrl()}/api/commercial-benefit/codes/activate`, {
      contextRef: {contextType: 'order', contextId: 'order-coupon-code'},
      code: 'COUPON100',
      codeType: 'couponCode',
      idempotencyKey: 'COUPON100:order-coupon-code',
    })

    expect(coupon.status).toBe(201)
    expect(coupon.payload.data).toMatchObject({
      activatedTemplates: [
        {
          templateKey: 'code-template-COUPON100',
          settlementPolicy: {settlementLineType: 'coupon_deduction'},
        },
      ],
      activatedLines: [
        {
          lineKey: 'code-line-COUPON100',
          lineType: 'asset',
          status: 'available',
        },
      ],
    })
  })
})
