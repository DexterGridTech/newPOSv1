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

describe('topology-runtime-v2 live terminal bridge sequential', () => {
    it('continues mirroring sequential terminal projection updates to slave through topology state sync', async () => {
        const harness = await createTerminalTopologyIntegrationHarnessV2()

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000003',
                deviceId: 'device-live-terminal-topology-bridge-v2-sequential-001',
            })

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-sequential-001',
                    featureFlag: true,
                    mode: 'initial',
                },
            })

            await waitFor(() => {
                return selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta').length > 0
            }, 5_000)

            const itemKey = selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta')[0]?.itemKey
            if (!itemKey) {
                throw new Error('missing initial config.delta projection item key')
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
                    'terminal-topology-bridge-v2-sequential-001',
                )
            }, 5_000)

            const firstBridgeEntry = selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]
            const firstRevision = firstBridgeEntry?.revision
            if (typeof firstRevision !== 'number') {
                throw new Error('missing first bridge revision')
            }

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-sequential-002',
                    featureFlag: false,
                    mode: 'updated',
                },
            })

            await waitFor(() => {
                const nextProjection = selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta')
                    .find(item => item.itemKey === itemKey)
                return Boolean(
                    nextProjection
                    && nextProjection.payload
                    && typeof nextProjection.payload === 'object'
                    && 'configVersion' in nextProjection.payload
                    && nextProjection.payload.configVersion === 'terminal-topology-bridge-v2-sequential-002',
                )
            }, 5_000)

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
                    'terminal-topology-bridge-v2-sequential-002',
                )
            }, 5_000)

            const masterBridgeEntry = selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]
            const slaveBridgeEntry = selectTerminalBridgeState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]

            expect(masterBridgeEntry?.revision).toBeGreaterThan(firstRevision)
            expect(masterBridgeEntry).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-sequential-002',
                    featureFlag: false,
                    mode: 'updated',
                },
            })
            expect(slaveBridgeEntry).toEqual(masterBridgeEntry)
        } finally {
            await harness.disconnect()
        }
    })
})
