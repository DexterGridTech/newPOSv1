import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpProjectionByTopicAndBucket,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncV2CommandDefinitions,
} from '../../src'
import {
    activateLiveTerminal,
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime-v2 live roundtrip', () => {
    it('connects to mock-terminal-platform, performs handshake, and receives live projection updates', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, '200000000002', 'device-live-tdp-v2-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id after tdp v2 activation')
        }

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.v2-live-001',
            payload: {
                configVersion: 'tdp-v2-live-001',
                featureFlag: true,
            },
        })

        await waitFor(() => {
            return selectTdpProjectionByTopicAndBucket(runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'config.delta.v2-live-001',
            })?.payload.configVersion === 'tdp-v2-live-001'
        }, 5_000)

        expect(selectTdpSessionState(runtime.getState())).toMatchObject({
            status: 'READY',
            syncMode: 'full',
        })
        expect(selectTdpSyncState(runtime.getState())?.lastCursor).toBeGreaterThan(0)
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.v2-live-001',
        })?.payload).toMatchObject({
            configVersion: 'tdp-v2-live-001',
            featureFlag: true,
        })
    })
})
