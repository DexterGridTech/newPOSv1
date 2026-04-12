import {describe, expect, it} from 'vitest'
import {selectTdpProjectionState} from '@impos2/kernel-base-tdp-sync-runtime'
import {
    createTerminalTopologyBridgeLiveHarness,
    type TerminalBridgeEntry,
    selectTerminalBridgeState,
} from '../helpers/terminalTopologyBridgeHarness'
import {installTopologyClientServerCleanup, waitFor} from '../helpers/topologyClientHarness'

installTopologyClientServerCleanup()

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

describe('topology-client-runtime live terminal bridge sequential', () => {
    it('continues mirroring sequential terminal projection updates to slave through topology state sync', async () => {
        const harness = await createTerminalTopologyBridgeLiveHarness()

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000003',
                deviceId: 'device-live-terminal-topology-bridge-sequential-001',
            })

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-sequential-001',
                    featureFlag: true,
                    mode: 'initial',
                },
            })

            await waitFor(() => {
                const projectionState = selectTdpProjectionState(harness.masterRuntime.getState())
                return Boolean(projectionState?.byTopic['config.delta'])
            }, 5_000)

            const initialProjectionState = selectTdpProjectionState(harness.masterRuntime.getState())
            const itemKey = Object.keys(initialProjectionState?.byTopic['config.delta'] ?? {})[0]
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
                    'terminal-topology-bridge-sequential-001',
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
                    configVersion: 'terminal-topology-bridge-sequential-002',
                    featureFlag: false,
                    mode: 'updated',
                },
            })

            await waitFor(() => {
                const projectionState = selectTdpProjectionState(harness.masterRuntime.getState())
                const nextProjection = projectionState?.byTopic['config.delta']?.[itemKey]
                return Boolean(
                    nextProjection
                    && nextProjection.payload
                    && typeof nextProjection.payload === 'object'
                    && 'configVersion' in nextProjection.payload
                    && nextProjection.payload.configVersion === 'terminal-topology-bridge-sequential-002',
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
                    'terminal-topology-bridge-sequential-002',
                )
            }, 5_000)

            const masterBridgeEntry = selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]
            const slaveBridgeEntry = selectTerminalBridgeState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]

            expect(masterBridgeEntry).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-sequential-002',
                    featureFlag: false,
                    mode: 'updated',
                },
            })
            expect(slaveBridgeEntry).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-sequential-002',
                    featureFlag: false,
                    mode: 'updated',
                },
            })
            expect((masterBridgeEntry?.revision ?? 0)).toBeGreaterThan(firstRevision)
            expect(slaveBridgeEntry?.revision).toBe(masterBridgeEntry?.revision)
        } finally {
            await harness.disconnect()
        }
    })
})
