import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    selectTdpControlSignalsState,
    selectTdpSessionState,
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

describe('tdp-sync-runtime-v2 live control signals', () => {
    it('accepts real server-side control signals and protocol error injection', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, platform.prepare.sandboxId, '200000000004', 'device-live-tdp-v2-signal-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)
        const sessionId = (await platform.admin.sessions())[0]?.sessionId
        if (!sessionId) {
            throw new Error('missing live session for control signals')
        }

        await platform.admin.edgeDegraded(sessionId, {
            reason: 'edge-overload-live-v2',
            nodeState: 'degraded',
            gracePeriodSeconds: 15,
            alternativeEndpoints: ['ws://backup-a'],
        })
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'DEGRADED', 5_000)

        await platform.admin.rehome(sessionId, {
            reason: 'rebalance-live-v2',
            deadline: '2026-04-13T18:00:00.000Z',
            alternativeEndpoints: ['ws://backup-b'],
        })
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'REHOME_REQUIRED', 5_000)

        await platform.admin.protocolError(sessionId, {
            code: 'ADMIN_FORCED_ERROR_V2',
            message: 'forced by live v2 test',
            closeAfterSend: false,
        })
        await waitFor(() => Boolean(selectTdpControlSignalsState(runtime.getState())?.lastProtocolError), 5_000)

        const controlSignals = selectTdpControlSignalsState(runtime.getState())
        expect(controlSignals?.lastEdgeDegraded).toMatchObject({
            reason: 'edge-overload-live-v2',
            nodeState: 'degraded',
        })
        expect(controlSignals?.lastRehomeRequired).toMatchObject({
            reason: 'rebalance-live-v2',
        })
        expect(controlSignals?.lastProtocolError).toMatchObject({
            key: 'kernel.base.tdp-sync-runtime-v2.protocol_error',
        })
    })
})
