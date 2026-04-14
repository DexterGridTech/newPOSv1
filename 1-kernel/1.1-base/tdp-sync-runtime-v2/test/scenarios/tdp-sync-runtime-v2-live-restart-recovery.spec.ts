import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpCommandInboxState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionState,
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

describe('tdp-sync-runtime-v2 live restart recovery', () => {
    it('rehydrates persisted cursor and projection repository after real restart and reconnects in incremental mode', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tdp-sync-runtime-v2-live-restart')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await firstRuntimeHarness.runtime.start()
        await activateLiveTerminal(firstRuntimeHarness.runtime, '200000000006', 'device-live-tdp-v2-restart-001')
        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(firstRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)

        const terminalId = selectTcpTerminalId(firstRuntimeHarness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before restart recovery seed')
        }

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.v2.restart-001',
            payload: {
                configVersion: 'restart-v2-seed-v1',
                source: 'seed-phase',
            },
        })

        await waitFor(() => {
            const sync = selectTdpSyncState(firstRuntimeHarness.runtime.getState())
            const projection = selectTdpProjectionByTopicAndBucket(firstRuntimeHarness.runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'config.delta.v2.restart-001',
            })
            return typeof sync?.lastCursor === 'number'
                && sync.lastCursor > 0
                && projection?.payload.configVersion === 'restart-v2-seed-v1'
        }, 10_000)

        const seededSyncState = selectTdpSyncState(firstRuntimeHarness.runtime.getState())
        const seededCursor = seededSyncState?.lastCursor
        const seededAppliedCursor = seededSyncState?.lastAppliedCursor
        if (typeof seededCursor !== 'number' || typeof seededAppliedCursor !== 'number') {
            throw new Error('missing persisted cursor state before restart')
        }

        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.disconnectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await firstRuntimeHarness.runtime.flushPersistence()

        const persistedKeys = await storagePair.stateStorage.storage.getAllKeys?.()
        expect((persistedKeys ?? []).some(key => key.endsWith(':kernel.base.tdp-sync-runtime-v2.sync:lastCursor'))).toBe(true)
        expect((persistedKeys ?? []).some(key => key.endsWith(':kernel.base.tdp-sync-runtime-v2.sync:lastAppliedCursor'))).toBe(true)
        expect((persistedKeys ?? []).some(key => key.includes('kernel.base.tdp-sync-runtime-v2.projection:entries:config.delta:TERMINAL'))).toBe(true)

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.v2.restart-001',
            payload: {
                configVersion: 'restart-v2-seed-v2',
                source: 'verify-phase',
            },
        })

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await secondRuntimeHarness.runtime.start()

        expect(selectTdpSyncState(secondRuntimeHarness.runtime.getState())).toMatchObject({
            lastCursor: seededCursor,
            lastAppliedCursor: seededAppliedCursor,
        })
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.v2.restart-001',
        })?.payload.configVersion).toBe('restart-v2-seed-v1')
        expect(selectTdpCommandInboxState(secondRuntimeHarness.runtime.getState())?.orderedIds ?? []).toEqual([])

        await secondRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => {
            const session = selectTdpSessionState(secondRuntimeHarness.runtime.getState())
            return session?.status === 'READY' && session.syncMode === 'incremental'
        }, 10_000)

        await waitFor(() => {
            return selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'config.delta.v2.restart-001',
            })?.payload.configVersion === 'restart-v2-seed-v2'
        }, 10_000)

        expect(selectTdpSyncState(secondRuntimeHarness.runtime.getState())?.lastCursor).toBeGreaterThan(seededCursor)
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.v2.restart-001',
        })?.payload.configVersion).toBe('restart-v2-seed-v2')
        expect(Object.keys(selectTdpProjectionState(secondRuntimeHarness.runtime.getState()) ?? {}).length).toBeGreaterThan(0)
        expect(selectTdpCommandInboxState(secondRuntimeHarness.runtime.getState())?.orderedIds ?? []).toEqual([])
    }, 20_000)
})
