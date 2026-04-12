import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpControlSignalsState,
    selectTdpSessionState,
    tdpSyncCommandNames,
} from '../../src'
import {
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime live control signals', () => {
    it('accepts real server-side control signals and protocol error injection', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await runtime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-live-signal-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000004',
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')
        const sessionId = (await platform.admin.sessions())[0]?.sessionId
        if (!sessionId) {
            throw new Error('missing live session for control signals')
        }

        await platform.admin.edgeDegraded(sessionId, {
            reason: 'edge-overload-live',
            nodeState: 'degraded',
            gracePeriodSeconds: 15,
            alternativeEndpoints: ['ws://backup-a'],
        })
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'DEGRADED')

        await platform.admin.rehome(sessionId, {
            reason: 'rebalance-live',
            deadline: '2026-04-11T18:00:00.000Z',
            alternativeEndpoints: ['ws://backup-b'],
        })
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'REHOME_REQUIRED')

        await platform.admin.protocolError(sessionId, {
            code: 'ADMIN_FORCED_ERROR',
            message: 'forced by live test',
            closeAfterSend: false,
        })
        await waitFor(() => Boolean(selectTdpControlSignalsState(runtime.getState())?.lastProtocolError))

        const controlSignals = selectTdpControlSignalsState(runtime.getState())
        expect(controlSignals?.lastEdgeDegraded).toMatchObject({
            reason: 'edge-overload-live',
            nodeState: 'degraded',
        })
        expect(controlSignals?.lastRehomeRequired).toMatchObject({
            reason: 'rebalance-live',
        })
        expect(controlSignals?.lastProtocolError).toMatchObject({
            key: 'kernel.base.tdp-sync-runtime.protocol_error',
        })
    })
})
