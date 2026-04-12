import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
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

describe('tdp-sync-runtime live projection', () => {
    it('receives admin-side projection updates, advances cursor, and syncs ack/apply to server session state', async () => {
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
                    id: 'device-live-projection-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000002',
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')
        const sessionsBefore = await platform.admin.sessions()
        const sessionId = sessionsBefore[0]?.sessionId
        const highWatermarkBefore = sessionsBefore[0]?.highWatermark ?? 0
        if (!sessionId) {
            throw new Error('missing live session id')
        }

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: sessionsBefore[0].terminalId,
            itemKey: 'config.delta.live-001',
            payload: {
                configVersion: 'config-live-001',
                featureFlag: true,
            },
        })

        await waitFor(() => {
            return Boolean(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: sessionsBefore[0].terminalId,
                itemKey: 'config.delta.live-001',
            }))
        })

        const projectionState = selectTdpProjectionState(runtime.getState())
        const syncState = selectTdpSyncState(runtime.getState())
        const item = selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: sessionsBefore[0].terminalId,
            itemKey: 'config.delta.live-001',
        })

        expect(item).toMatchObject({
            topic: 'config.delta',
            payload: {
                configVersion: 'config-live-001',
                featureFlag: true,
            },
        })
        expect(syncState?.lastCursor).toBeGreaterThan(highWatermarkBefore)
        expect(syncState?.lastAckedCursor).toBe(syncState?.lastCursor)
        expect(syncState?.lastAppliedCursor).toBe(syncState?.lastCursor)

        await waitFor(async () => {
            const sessions = await platform.admin.sessions()
            const session = sessions.find(itemValue => itemValue.sessionId === sessionId)
            return Boolean(
                session
                && session.lastAckedRevision === syncState?.lastCursor
                && session.lastAppliedRevision === syncState?.lastCursor,
            )
        })

        const changeLogs = await platform.admin.changeLogs()
        expect(changeLogs.some(itemValue =>
            itemValue.topicKey === 'config.delta'
            && itemValue.payload?.configVersion === 'config-live-001',
        )).toBe(true)
        expect(Object.keys(projectionState ?? {}).length).toBeGreaterThan(0)
    })
})
