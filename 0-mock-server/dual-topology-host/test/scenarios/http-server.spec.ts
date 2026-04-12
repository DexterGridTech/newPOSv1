import {afterEach, describe, expect, it} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {
    moduleName,
    createDualTopologyHostServer,
    dualTopologyHostServerParameters,
} from '../../src'
import {fetchJson} from '../helpers/http'

const servers: Array<ReturnType<typeof createDualTopologyHostServer>> = []

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('dual-topology-host http server', () => {
    it('serves health, stats, tickets, and fault-rule management over real HTTP', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 1_000,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()

        const health = await fetchJson<{
            status: string
            now: number
            moduleName: string
        }>(`${addressInfo.httpBaseUrl}/health`)

        expect(health.status).toBe('ok')
        expect(health.moduleName).toBe(moduleName)
        expect(typeof health.now).toBe('number')

        const initialStats = await fetchJson<{
            ticketCount: number
            sessionCount: number
            activeConnectionCount: number
            activeFaultRuleCount: number
        }>(`${addressInfo.httpBaseUrl}/stats`)

        expect(initialStats.ticketCount).toBe(0)
        expect(initialStats.sessionCount).toBe(0)
        expect(initialStats.activeConnectionCount).toBe(0)
        expect(initialStats.activeFaultRuleCount).toBe(0)

        const ticket = await fetchJson<{
            success: boolean
            token: string
            sessionId: string
            expiresAt: number
            transportUrls: string[]
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId: createNodeId(),
            }),
        })

        expect(ticket.success).toBe(true)
        expect(ticket.token).toMatch(/^ticket_/)
        expect(ticket.transportUrls).toEqual([addressInfo.wsUrl])
        expect(ticket.expiresAt).toBeGreaterThan(Date.now())

        const replaceFaultRules = await fetchJson<{
            success: boolean
            ruleCount: number
        }>(`${addressInfo.httpBaseUrl}/fault-rules`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                rules: [
                    {
                        id: 'delay-dispatch',
                        channel: 'dispatch',
                        delayMs: 25,
                    },
                ],
            }),
        })

        expect(replaceFaultRules).toEqual({
            success: true,
            ruleCount: 1,
        })

        const statsAfterMutations = await fetchJson<{
            ticketCount: number
            activeFaultRuleCount: number
        }>(`${addressInfo.httpBaseUrl}/stats`)

        expect(statsAfterMutations.ticketCount).toBe(1)
        expect(statsAfterMutations.activeFaultRuleCount).toBe(1)
    })

    it('uses exported default ticket expiry when request does not override expiresInMs', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const before = Date.now()

        const ticket = await fetchJson<{
            success: boolean
            expiresAt: number
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId: createNodeId(),
            }),
        })

        expect(ticket.success).toBe(true)
        expect(ticket.expiresAt).toBeGreaterThanOrEqual(
            before + dualTopologyHostServerParameters.defaultTicketExpiresInMs.defaultValue,
        )
    })
})
