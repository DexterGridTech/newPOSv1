import {describe, expect, it} from 'vitest'
import {selectTdpProjectionEntriesByTopic, selectTdpSessionState} from '@impos2/kernel-base-tdp-sync-runtime-v2'
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

describe('topology-runtime-v2 live terminal bridge reconnect', () => {
    it('continues mirroring terminal projection updates to slave after TDP forced close and reconnect', async () => {
        const harness = await createTerminalTopologyIntegrationHarnessV2({
            tdpReconnectIntervalMs: 50,
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000005',
                deviceId: 'device-live-terminal-topology-bridge-v2-reconnect-001',
            })

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-reconnect-before',
                    featureFlag: true,
                },
            })

            await waitFor(() => {
                return selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta').length > 0
            }, 5_000)

            const itemKey = selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta')[0]?.itemKey
            if (!itemKey) {
                throw new Error('missing config.delta projection item key before reconnect')
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
                    'terminal-topology-bridge-v2-reconnect-before',
                )
            }, 5_000)

            const previousSessionId = await harness.forceCloseActiveTdpSession({
                code: 1012,
                reason: 'terminal-bridge-reconnect-test-v2',
            })

            const reconnectedSession = await harness.waitForReconnectedTdpSession(previousSessionId, 5_000)
            expect(reconnectedSession?.syncMode).toBe('incremental')
            expect(reconnectedSession?.sessionId).not.toBe(previousSessionId)
            expect(selectTdpSessionState(harness.masterRuntime.getState())?.status).toBe('READY')

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-reconnect-after',
                    featureFlag: false,
                },
            })

            await waitFor(() => {
                const projection = selectTdpProjectionEntriesByTopic(harness.masterRuntime.getState(), 'config.delta')
                    .find(item => item.itemKey === itemKey)
                return Boolean(
                    projection
                    && projection.payload
                    && typeof projection.payload === 'object'
                    && 'configVersion' in projection.payload
                    && projection.payload.configVersion === 'terminal-topology-bridge-v2-reconnect-after',
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
                    'terminal-topology-bridge-v2-reconnect-after',
                )
            }, 5_000)

            expect(selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-reconnect-after',
                    featureFlag: false,
                },
            })
            expect(selectTerminalBridgeState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                payload: {
                    configVersion: 'terminal-topology-bridge-v2-reconnect-after',
                    featureFlag: false,
                },
            })
        } finally {
            await harness.disconnect()
        }
    })
})
