import {describe, expect, it} from 'vitest'
import {selectTdpProjectionEntriesByTopic} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {
    createTerminalTopologyIntegrationHarnessV2,
} from '../helpers/terminalTopologyIntegrationHarness'
import {
    selectTerminalBridgeState,
    type TerminalBridgeEntry,
} from '../helpers/terminalReadModelModules'
import {waitFor} from '../helpers/liveHarness'

const hasConfigVersion = (
    entry: TerminalBridgeEntry | undefined,
    configVersion: string,
) => {
    return Boolean(
        entry
        && entry.payload
        && typeof entry.payload === 'object'
        && 'configVersion' in entry.payload
        && entry.payload.configVersion === configVersion,
    )
}

describe('topology-runtime-v2 live terminal bridge', () => {
    it('mirrors terminal projection data from master runtime to slave runtime through real topology state sync', async () => {
        const harness = await createTerminalTopologyIntegrationHarnessV2()

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000002',
                deviceId: 'device-live-terminal-topology-bridge-v2-001',
            })

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-001',
                    featureFlag: true,
                },
            })

            await waitFor(() => {
                return selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta').length > 0
            }, 5_000)

            const itemKey = selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta')[0]?.itemKey
            if (!itemKey) {
                throw new Error('missing config.delta projection item key')
            }

            await harness.mirrorProjectionToTopologyBridge({
                topic: 'config.delta',
                itemKey,
            })

            await waitFor(() => {
                const slaveBridgeState = selectTerminalBridgeState(
                    harness.slaveRuntime.getState() as Record<string, unknown>,
                )
                return hasConfigVersion(
                    slaveBridgeState?.[`config.delta:${itemKey}`],
                    'terminal-topology-bridge-v2-001',
                )
            }, 5_000)

            expect(selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-001',
                    featureFlag: true,
                },
            })

            expect(selectTerminalBridgeState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-001',
                    featureFlag: true,
                },
            })
        } finally {
            await harness.disconnect()
        }
    })
})
