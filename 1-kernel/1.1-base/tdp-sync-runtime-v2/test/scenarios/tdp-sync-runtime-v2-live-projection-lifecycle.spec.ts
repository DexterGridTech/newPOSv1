import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {createRequestId} from '@next/kernel-base-contracts'
import {selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpActiveProjectionEntries,
    selectTdpProjectionByTopicAndBucket,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncV2CommandDefinitions,
} from '../../src'
import {
    activateLiveTerminal,
    createLiveFileStoragePair,
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []
const storagePairs: Array<ReturnType<typeof createLiveFileStoragePair>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
    storagePairs.splice(0).forEach(pair => pair.cleanup())
})

describe('tdp-sync-runtime-v2 live projection lifecycle / TTL', () => {
    it('receives expiring projection, applies TTL tombstone, and does not restore expired data after restart', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tdp-sync-runtime-v2-live-projection-lifecycle')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_projection_lifecycle',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
            extraModules: [{
                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test.order-payment-topic',
                packageVersion: '0.0.1',
                tdpTopicInterests: [{
                    topicKey: 'order.payment.completed',
                    required: true,
                    reason: 'live projection lifecycle test consumes order payment notifications',
                }],
            }],
        })

        await firstRuntimeHarness.runtime.start()
        await activateLiveTerminal(
            firstRuntimeHarness.runtime,
            platform.prepare.sandboxId,
            '200000000006',
            'device-live-tdp-v2-projection-lifecycle-001',
        )
        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(firstRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)

        const terminalId = selectTcpTerminalId(firstRuntimeHarness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id for projection lifecycle live test')
        }

        const publish = await platform.admin.upsertProjectionBatch({
            projections: [{
                topicKey: 'order.payment.completed',
                scopeType: 'TERMINAL',
                scopeKey: terminalId,
                itemKey: 'payment-live-lifecycle-001',
                ttlMs: 1_000,
                payload: {
                    projectionKind: 'order_payment_completed',
                    orderId: 'order-live-lifecycle-001',
                    paid: true,
                },
                targetTerminalIds: [terminalId],
            }],
        })
        expect(publish.items?.[0]).toMatchObject({
            status: 'ACCEPTED',
            topicKey: 'order.payment.completed',
            itemKey: 'payment-live-lifecycle-001',
        })
        const expiresAt = publish.items?.[0]?.expiresAt
        expect(typeof expiresAt).toBe('string')

        await waitFor(() => {
            return selectTdpProjectionByTopicAndBucket(firstRuntimeHarness.runtime.getState(), {
                topic: 'order.payment.completed',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'payment-live-lifecycle-001',
            })?.payload.orderId === 'order-live-lifecycle-001'
        }, 10_000)

        const cursorAfterUpsert = selectTdpSyncState(firstRuntimeHarness.runtime.getState())?.lastCursor
        expect(cursorAfterUpsert).toBeGreaterThan(0)

        await new Promise(resolve => setTimeout(resolve, 1_100))
        const expireRun = await platform.admin.runProjectionExpiryOnce()
        expect(expireRun).toMatchObject({
            generatedTombstoneCount: 1,
            expiredProjectionCount: 1,
        })

        await waitFor(() => {
            return !selectTdpProjectionByTopicAndBucket(firstRuntimeHarness.runtime.getState(), {
                topic: 'order.payment.completed',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'payment-live-lifecycle-001',
            })
        }, 10_000)

        const cursorAfterDelete = selectTdpSyncState(firstRuntimeHarness.runtime.getState())?.lastCursor
        expect(cursorAfterDelete).toBeGreaterThan(cursorAfterUpsert ?? 0)

        const changeLogs = await platform.admin.changeLogs()
        const lifecycleLogs = changeLogs.filter(item =>
            item.topicKey === 'order.payment.completed'
            && item.itemKey === 'payment-live-lifecycle-001')
        expect(lifecycleLogs.map(item => item.operation)).toEqual(['delete', 'upsert'])
        expect(lifecycleLogs.find(item => item.operation === 'delete')).toMatchObject({
            changeReason: 'TTL_EXPIRED',
            expiresAt: Date.parse(expiresAt),
        })

        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.disconnectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await firstRuntimeHarness.runtime.flushPersistence()

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_projection_lifecycle',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
            extraModules: [{
                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test.order-payment-topic',
                packageVersion: '0.0.1',
                tdpTopicInterests: [{
                    topicKey: 'order.payment.completed',
                    required: true,
                    reason: 'live projection lifecycle restart recovery test',
                }],
            }],
        })
        await secondRuntimeHarness.runtime.start()
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'order.payment.completed',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'payment-live-lifecycle-001',
        })).toBeUndefined()
        expect(Object.values(selectTdpActiveProjectionEntries(secondRuntimeHarness.runtime.getState())).some(entry =>
            entry.topic === 'order.payment.completed'
            && entry.itemKey === 'payment-live-lifecycle-001',
        )).toBe(false)

        await secondRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await waitFor(() => selectTdpSessionState(secondRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'order.payment.completed',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'payment-live-lifecycle-001',
        })).toBeUndefined()

        const lateRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [{
                moduleName: 'kernel.base.tdp-sync-runtime-v2.live-test.order-payment-topic.late',
                packageVersion: '0.0.1',
                tdpTopicInterests: [{
                    topicKey: 'order.payment.completed',
                    required: true,
                    reason: 'live projection lifecycle late terminal snapshot test',
                }],
            }],
        })
        await lateRuntimeHarness.runtime.start()
        await activateLiveTerminal(
            lateRuntimeHarness.runtime,
            platform.prepare.sandboxId,
            '200000000007',
            'device-live-tdp-v2-projection-lifecycle-002',
        )
        await lateRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await waitFor(() => selectTdpSessionState(lateRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)
        expect(Object.values(selectTdpActiveProjectionEntries(lateRuntimeHarness.runtime.getState())).some(entry =>
            entry.topic === 'order.payment.completed'
            && entry.itemKey === 'payment-live-lifecycle-001',
        )).toBe(false)
    }, 30_000)
})
