import {describe, expect, it} from 'vitest'
import {selectTdpProjectionState, selectTdpSessionState} from '@impos2/kernel-base-tdp-sync-runtime'
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

describe('topology-client-runtime live terminal bridge reconnect', () => {
    it('continues mirroring terminal projection updates to slave after TDP forced close and reconnect', async () => {
        const harness = await createTerminalTopologyBridgeLiveHarness({
            tdpReconnectIntervalMs: 50,
        })

        try {
            await harness.configureTopologyPair()
            await harness.startTopologyConnectionPair()
            await harness.activateAndConnectTerminal({
                activationCode: '200000000005',
                deviceId: 'device-live-terminal-topology-bridge-reconnect-001',
            })

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-reconnect-before',
                    featureFlag: true,
                },
            })

            await waitFor(() => {
                const projectionState = selectTdpProjectionState(harness.masterRuntime.getState())
                return Boolean(projectionState?.byTopic['config.delta'])
            }, 5_000)

            const beforeReconnectProjectionState = selectTdpProjectionState(harness.masterRuntime.getState())
            const itemKey = Object.keys(beforeReconnectProjectionState?.byTopic['config.delta'] ?? {})[0]
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
                    'terminal-topology-bridge-reconnect-before',
                )
            }, 5_000)

            const previousSessionId = await harness.forceCloseActiveTdpSession({
                code: 1012,
                reason: 'terminal-bridge-reconnect-test',
            })

            const reconnectedSession = await harness.waitForReconnectedTdpSession(previousSessionId, 5_000)
            expect(reconnectedSession?.syncMode).toBe('incremental')
            expect(reconnectedSession?.sessionId).not.toBe(previousSessionId)
            expect(selectTdpSessionState(harness.masterRuntime.getState())?.status).toBe('READY')

            await harness.upsertProjection({
                topicKey: 'config.delta',
                payload: {
                    configVersion: 'terminal-topology-bridge-reconnect-after',
                    featureFlag: false,
                },
            })

            await waitFor(() => {
                const projectionState = selectTdpProjectionState(harness.masterRuntime.getState())
                const projection = projectionState?.byTopic['config.delta']?.[itemKey]
                return Boolean(
                    projection
                    && projection.payload
                    && typeof projection.payload === 'object'
                    && 'configVersion' in projection.payload
                    && projection.payload.configVersion === 'terminal-topology-bridge-reconnect-after',
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
                    'terminal-topology-bridge-reconnect-after',
                )
            }, 5_000)

            expect(selectTerminalBridgeState(
                harness.masterRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-reconnect-after',
                    featureFlag: false,
                },
            })

            expect(selectTerminalBridgeState(
                harness.slaveRuntime.getState() as Record<string, unknown>,
            )?.[`config.delta:${itemKey}`]).toMatchObject({
                topic: 'config.delta',
                itemKey,
                payload: {
                    configVersion: 'terminal-topology-bridge-reconnect-after',
                    featureFlag: false,
                },
            })
        } finally {
            await harness.disconnect()
        }
    })
})
