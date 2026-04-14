import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
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

describe('tdp-sync-runtime-v2 live projection feedback', () => {
    it('receives projection updates and syncs ack/apply cursor back to server session state', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, '200000000002', 'device-live-tdp-v2-projection-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        const sessionsBefore = await platform.admin.sessions()
        const sessionId = sessionsBefore[0]?.sessionId
        const terminalId = sessionsBefore[0]?.terminalId
        const highWatermarkBefore = sessionsBefore[0]?.highWatermark ?? 0
        if (!sessionId || !terminalId) {
            throw new Error('missing live session before projection feedback test')
        }

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.v2-live-001',
            payload: {
                configVersion: 'config-v2-live-001',
                featureFlag: true,
            },
        })

        await waitFor(() => Boolean(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.v2-live-001',
        })), 5_000)

        const syncState = selectTdpSyncState(runtime.getState())
        expect(syncState?.lastCursor).toBeGreaterThan(highWatermarkBefore)
        expect(syncState?.lastAckedCursor).toBe(syncState?.lastCursor)
        expect(syncState?.lastAppliedCursor).toBe(syncState?.lastCursor)

        await waitFor(async () => {
            const sessions = await platform.admin.sessions()
            const session = sessions.find(item => item.sessionId === sessionId)
            return Boolean(
                session
                && session.lastAckedRevision === syncState?.lastCursor
                && session.lastAppliedRevision === syncState?.lastCursor,
            )
        }, 5_000)

        const changeLogs = await platform.admin.changeLogs()
        expect(changeLogs.some(item =>
            item.topicKey === 'config.delta'
            && item.payload?.configVersion === 'config-v2-live-001',
        )).toBe(true)
    })
})
