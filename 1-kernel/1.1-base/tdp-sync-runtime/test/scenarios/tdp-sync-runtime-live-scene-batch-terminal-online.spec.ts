import {afterEach, describe, expect, it} from 'vitest'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionEntriesByTopic,
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
} from '../../src'
import {
    activateAndConnectLiveRuntime,
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime live scene batch terminal online', () => {
    it('receives scene-driven tcp.task.release projection and advances task delivery state through the real data plane', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateAndConnectLiveRuntime(runtime, {
            activationCode: '200000000003',
            deviceId: 'device-live-scene-001',
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before scene run')
        }

        const syncBefore = selectTdpSyncState(runtime.getState())
        const highWatermarkBefore = syncBefore?.lastCursor ?? 0

        const sceneResult = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [terminalId],
            batchCount: 2,
        })
        expect(sceneResult.release?.releaseId).toBeTruthy()
        expect(sceneResult.tdp?.mode).toBe('PROJECTION')
        expect(sceneResult.targetTerminalIds).toEqual([terminalId])

        await waitFor(() => {
            const taskReleases = selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release')
            return taskReleases.some(item =>
                item.scopeId === terminalId
                && item.sourceReleaseId === sceneResult.release.releaseId,
            )
        }, 5_000)

        const projectionState = selectTdpProjectionState(runtime.getState())
        const matchedProjection = selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release').find(item =>
            item.scopeId === terminalId
            && item.sourceReleaseId === sceneResult.release.releaseId,
        )

        expect(matchedProjection).toMatchObject({
            topic: 'tcp.task.release',
            scopeId: terminalId,
            sourceReleaseId: sceneResult.release.releaseId,
            payload: {
                releaseId: sceneResult.release.releaseId,
                payload: {
                    configVersion: 'config-2026.04.06',
                    strategy: 'immediate',
                },
            },
        })

        const syncAfter = selectTdpSyncState(runtime.getState())
        expect(syncAfter?.lastCursor).toBeGreaterThan(highWatermarkBefore)
        expect(syncAfter?.lastAckedCursor).toBe(syncAfter?.lastCursor)
        expect(syncAfter?.lastAppliedCursor).toBe(syncAfter?.lastCursor)

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            return taskInstances.some(item =>
                item.releaseId === sceneResult.release.releaseId
                && item.terminalId === terminalId
                && (item.deliveryStatus === 'DELIVERED' || item.deliveryStatus === 'ACKED'),
            )
        }, 5_000)

        const taskInstances = await platform.admin.taskInstances()
        const matchedInstance = taskInstances.find(item =>
            item.releaseId === sceneResult.release.releaseId
            && item.terminalId === terminalId,
        )

        expect(Object.keys(projectionState ?? {}).length).toBeGreaterThan(0)
        expect(matchedInstance).toMatchObject({
            releaseId: sceneResult.release.releaseId,
            terminalId,
        })
        expect(['DELIVERED', 'ACKED']).toContain(matchedInstance?.deliveryStatus)
    })
})
