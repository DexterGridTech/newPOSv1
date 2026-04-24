import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {createRequestId} from '@next/kernel-base-contracts'
import {selectTcpTerminalId} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpHotUpdateDesired,
    selectTdpHotUpdateState,
    selectTdpSessionState,
    tdpSyncV2CommandDefinitions,
    TDP_HOT_UPDATE_ITEM_KEY,
    TDP_HOT_UPDATE_TOPIC,
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

describe('tdp-sync-runtime-v2 live hot update restart recovery', () => {
    it('rehydrates persisted hot update desired/candidate after restart and continues incremental projection updates', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const storagePair = createLiveFileStoragePair('tdp-sync-runtime-v2-live-hot-update-restart')
        storagePairs.push(storagePair)

        const firstRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_hot_update_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await firstRuntimeHarness.runtime.start()
        await activateLiveTerminal(
            firstRuntimeHarness.runtime,
            platform.prepare.sandboxId,
            '200000000007',
            'device-live-tdp-v2-hot-update-restart-001',
        )
        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(firstRuntimeHarness.runtime.getState())?.status === 'READY', 10_000)

        const terminalId = selectTcpTerminalId(firstRuntimeHarness.runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before hot update restart seed')
        }

        await platform.admin.upsertProjection({
            topicKey: TDP_HOT_UPDATE_TOPIC,
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: TDP_HOT_UPDATE_ITEM_KEY,
            payload: {
                schemaVersion: 1,
                releaseId: 'release-live-hot-update-001',
                packageId: 'package-live-hot-update-001',
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                bundleVersion: '1.0.0+ota.1',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                packageUrl: 'http://mock/live-hot-update-001.zip',
                packageSize: 128,
                packageSha256: 'sha-live-hot-update-001',
                manifestSha256: 'manifest-live-hot-update-001',
                compatibility: {
                    appId: 'assembly-android-mixc-retail-rn84',
                    platform: 'android',
                    product: 'mixc-retail',
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                },
                restart: {
                    mode: 'idle',
                    idleWindowMs: 60_000,
                },
                rollout: {
                    mode: 'active',
                    publishedAt: '2026-04-18T00:00:00.000Z',
                },
                safety: {
                    requireSignature: false,
                    maxDownloadAttempts: 3,
                    maxLaunchFailures: 2,
                    healthCheckTimeoutMs: 5_000,
                },
            },
        })

        await waitFor(() => {
            const hotUpdate = selectTdpHotUpdateState(firstRuntimeHarness.runtime.getState())
            return hotUpdate?.desired?.releaseId === 'release-live-hot-update-001'
                && hotUpdate.candidate?.status === 'download-pending'
        }, 10_000)

        const seededState = selectTdpHotUpdateState(firstRuntimeHarness.runtime.getState())
        expect(seededState).toMatchObject({
            desired: {
                releaseId: 'release-live-hot-update-001',
                packageId: 'package-live-hot-update-001',
                bundleVersion: '1.0.0+ota.1',
            },
            candidate: {
                releaseId: 'release-live-hot-update-001',
                packageId: 'package-live-hot-update-001',
                status: 'download-pending',
            },
        })

        await firstRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.disconnectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await firstRuntimeHarness.runtime.flushPersistence()

        const persistedKeys = await storagePair.stateStorage.storage.getAllKeys?.()
        expect((persistedKeys ?? []).some((key: string) =>
            key.endsWith(':kernel.base.tdp-sync-runtime-v2.hot-update:desired'),
        )).toBe(true)
        expect((persistedKeys ?? []).some((key: string) =>
            key.endsWith(':kernel.base.tdp-sync-runtime-v2.hot-update:candidate'),
        )).toBe(true)

        await platform.admin.upsertProjection({
            topicKey: TDP_HOT_UPDATE_TOPIC,
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: TDP_HOT_UPDATE_ITEM_KEY,
            payload: {
                schemaVersion: 1,
                releaseId: 'release-live-hot-update-002',
                packageId: 'package-live-hot-update-002',
                appId: 'assembly-android-mixc-retail-rn84',
                platform: 'android',
                product: 'mixc-retail',
                bundleVersion: '1.0.0+ota.2',
                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                packageUrl: 'http://mock/live-hot-update-002.zip',
                packageSize: 256,
                packageSha256: 'sha-live-hot-update-002',
                manifestSha256: 'manifest-live-hot-update-002',
                compatibility: {
                    appId: 'assembly-android-mixc-retail-rn84',
                    platform: 'android',
                    product: 'mixc-retail',
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                },
                restart: {
                    mode: 'next-launch',
                },
                rollout: {
                    mode: 'active',
                    publishedAt: '2026-04-18T01:00:00.000Z',
                },
                safety: {
                    requireSignature: false,
                    maxDownloadAttempts: 3,
                    maxLaunchFailures: 2,
                    healthCheckTimeoutMs: 5_000,
                },
            },
        })

        const secondRuntimeHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_v2_live_hot_update_restart',
            stateStorage: storagePair.stateStorage,
            secureStateStorage: storagePair.secureStateStorage,
        })

        await secondRuntimeHarness.runtime.start()

        expect(selectTdpHotUpdateDesired(secondRuntimeHarness.runtime.getState())).toMatchObject({
            releaseId: 'release-live-hot-update-001',
            packageId: 'package-live-hot-update-001',
            bundleVersion: '1.0.0+ota.1',
        })
        expect(selectTdpHotUpdateState(secondRuntimeHarness.runtime.getState())?.candidate).toMatchObject({
            releaseId: 'release-live-hot-update-001',
            packageId: 'package-live-hot-update-001',
            status: 'download-pending',
        })

        await secondRuntimeHarness.runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => {
            const session = selectTdpSessionState(secondRuntimeHarness.runtime.getState())
            return session?.status === 'READY' && session.syncMode === 'incremental'
        }, 10_000)

        await waitFor(() => {
            const hotUpdate = selectTdpHotUpdateState(secondRuntimeHarness.runtime.getState())
            return hotUpdate?.desired?.releaseId === 'release-live-hot-update-002'
                && hotUpdate.candidate?.packageId === 'package-live-hot-update-002'
        }, 10_000)

        expect(selectTdpHotUpdateState(secondRuntimeHarness.runtime.getState())).toMatchObject({
            desired: {
                releaseId: 'release-live-hot-update-002',
                packageId: 'package-live-hot-update-002',
                bundleVersion: '1.0.0+ota.2',
            },
            candidate: {
                releaseId: 'release-live-hot-update-002',
                packageId: 'package-live-hot-update-002',
                status: 'download-pending',
            },
        })
    }, 20_000)
})
