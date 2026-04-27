import {describe, expect, it} from 'vitest'
import {createDualTopologyHostV3Server, moduleName} from '../../src'
import {fetchJson} from '../helpers/http'

describe('dual-topology-host-v3 http server', () => {
    it('exposes status and stats endpoints', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        await server.start()

        const status = await fetch(`${server.getAddressInfo().httpBaseUrl}/status`).then(response => response.json())
        const stats = await fetch(`${server.getAddressInfo().httpBaseUrl}/stats`).then(response => response.json())

        expect(status.state).toBeDefined()
        expect(stats.sessionCount).toBe(0)

        await server.close()
    })

    it('exposes diagnostics and fault-rule management endpoints', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        await server.start()

        try {
            const {httpBaseUrl} = server.getAddressInfo()

            const diagnostics = await fetchJson<{
                moduleName: string
                state: string
                peers: unknown[]
                faultRules: unknown[]
            }>(`${httpBaseUrl}/diagnostics`)

            expect(diagnostics.moduleName).toBe(moduleName)
            expect(diagnostics.state).toBe('running')
            expect(diagnostics.peers).toEqual([])
            expect(diagnostics.faultRules).toEqual([])

            const replaced = await fetchJson<{
                success: boolean
                ruleCount: number
            }>(`${httpBaseUrl}/fault-rules`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    rules: [
                        {
                            ruleId: 'delay-command',
                            kind: 'relay-delay',
                            channel: 'command-dispatch',
                            delayMs: 25,
                        },
                    ],
                }),
            })

            expect(replaced).toEqual({
                success: true,
                ruleCount: 1,
            })

            const afterReplace = await fetchJson<{
                activeFaultRuleCount: number
            }>(`${httpBaseUrl}/stats`)
            expect(afterReplace.activeFaultRuleCount).toBe(1)

            const deleted = await fetchJson<{
                success: boolean
                ruleCount: number
            }>(`${httpBaseUrl}/fault-rules`, {
                method: 'DELETE',
            })

            expect(deleted).toEqual({
                success: true,
                ruleCount: 0,
            })
        } finally {
            await server.close()
        }
    })
})
