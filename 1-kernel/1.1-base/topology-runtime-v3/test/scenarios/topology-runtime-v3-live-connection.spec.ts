import {describe, expect, it} from 'vitest'
import {createTopologyRuntimeV3LiveHarness} from '../helpers/liveHarness'

describe('topology-runtime-v3 live connection', () => {
    it('connects master and slave through dual-topology-host-v3 without tickets', async () => {
        const harness = await createTopologyRuntimeV3LiveHarness()

        try {
            await harness.start()
            expect(harness.master.getConnectionStatus()).toBe('ACTIVE')
            expect(harness.slave.getConnectionStatus()).toBe('ACTIVE')
            expect(harness.master.getPeerNodeId()).toBe('slave-node')
            expect(harness.slave.getPeerNodeId()).toBe('master-node')
            expect(harness.master.getSessionId()).toBeDefined()
            expect(harness.slave.getSessionId()).toBeDefined()
        } finally {
            await harness.close()
        }
    })
})
