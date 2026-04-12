import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames, selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpCommandInboxState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncCommandNames,
} from '../../src'
import {
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

describe('tdp-sync-runtime live restart recovery', () => {
    it('rehydrates persisted cursor state after real restart and reconnects in incremental mode without reviving old command inbox', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tdp-sync-runtime-live-restart')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await firstRuntimeHarness.runtime.start()
        await firstRuntimeHarness.runtime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-live-restart-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await firstRuntimeHarness.runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000006',
            },
            requestId: createRequestId(),
        })
        await firstRuntimeHarness.runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => selectTdpSessionState(firstRuntimeHarness.runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(firstRuntimeHarness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before restart recovery seed')
        }

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.restart-001',
            payload: {
                configVersion: 'restart-seed-v1',
                source: 'seed-phase',
            },
        })

        await waitFor(() => {
            const sync = selectTdpSyncState(firstRuntimeHarness.runtime.getState())
            const projection = selectTdpProjectionByTopicAndBucket(firstRuntimeHarness.runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'config.delta.restart-001',
            })
            return typeof sync?.lastCursor === 'number' && sync.lastCursor > 0 && projection?.payload.configVersion === 'restart-seed-v1'
        })

        const seededSyncState = selectTdpSyncState(firstRuntimeHarness.runtime.getState())
        const seededCursor = seededSyncState?.lastCursor
        const seededAppliedCursor = seededSyncState?.lastAppliedCursor
        if (typeof seededCursor !== 'number' || typeof seededAppliedCursor !== 'number') {
            throw new Error('missing persisted cursor state before restart')
        }

        await firstRuntimeHarness.runtime.execute({
            commandName: tdpSyncCommandNames.disconnectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })
        await firstRuntimeHarness.runtime.flushPersistence()

        const persistedKeys = await storagePair.stateStorage.storage.getAllKeys?.()
        expect((persistedKeys ?? []).some(key => key.endsWith(':lastCursor'))).toBe(true)
        expect((persistedKeys ?? []).some(key => key.endsWith(':lastAppliedCursor'))).toBe(true)
        expect((persistedKeys ?? []).some(key => key.includes('kernel.base.tdp-sync-runtime.projection:entries:config.delta:TERMINAL'))).toBe(true)

        await platform.admin.upsertProjection({
            topicKey: 'config.delta',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'config.delta.restart-001',
            payload: {
                configVersion: 'restart-seed-v2',
                source: 'verify-phase',
            },
        })

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_live_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await secondRuntimeHarness.runtime.start()

        const rehydratedSyncState = selectTdpSyncState(secondRuntimeHarness.runtime.getState())
        expect(rehydratedSyncState).toMatchObject({
            lastCursor: seededCursor,
            lastAppliedCursor: seededAppliedCursor,
        })
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.restart-001',
        })?.payload.configVersion).toBe('restart-seed-v1')
        expect(selectTdpCommandInboxState(secondRuntimeHarness.runtime.getState())?.orderedIds ?? []).toEqual([])

        await secondRuntimeHarness.runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => {
            const session = selectTdpSessionState(secondRuntimeHarness.runtime.getState())
            return session?.status === 'READY' && session.syncMode === 'incremental'
        }, 5_000)

        await waitFor(() => {
            return selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
                topic: 'config.delta',
                scopeType: 'TERMINAL',
                scopeId: terminalId,
                itemKey: 'config.delta.restart-001',
            })?.payload.configVersion === 'restart-seed-v2'
        }, 5_000)

        const recoveredSession = selectTdpSessionState(secondRuntimeHarness.runtime.getState())
        const recoveredSyncState = selectTdpSyncState(secondRuntimeHarness.runtime.getState())
        const recoveredProjectionState = selectTdpProjectionState(secondRuntimeHarness.runtime.getState())

        expect(recoveredSession).toMatchObject({
            status: 'READY',
            syncMode: 'incremental',
        })
        expect(recoveredSyncState?.lastCursor).toBeGreaterThan(seededCursor)
        expect(recoveredSyncState?.lastAppliedCursor).toBe(recoveredSyncState?.lastCursor)
        expect(selectTdpProjectionByTopicAndBucket(secondRuntimeHarness.runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            itemKey: 'config.delta.restart-001',
        })?.payload.configVersion).toBe('restart-seed-v2')
        expect(Object.keys(recoveredProjectionState ?? {}).length).toBeGreaterThan(0)
        expect(selectTdpCommandInboxState(secondRuntimeHarness.runtime.getState())?.orderedIds ?? []).toEqual([])
    })
})
