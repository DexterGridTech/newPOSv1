import {afterEach, describe, expect, it} from 'vitest'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionEntriesByTopic,
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

describe('tdp-sync-runtime live scene sequential progress', () => {
    it('advances cursor and keeps separate item-keyed projections across repeated scene-driven releases for the same terminal', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateAndConnectLiveRuntime(runtime, {
            activationCode: '200000000004',
            deviceId: 'device-live-scene-sequential-001',
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before sequential scene run')
        }

        const firstScene = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [terminalId],
            batchCount: 1,
        })
        expect(firstScene.release?.releaseId).toBeTruthy()

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release').some(item =>
                item.sourceReleaseId === firstScene.release.releaseId,
            )
        }, 5_000)

        const firstSyncState = selectTdpSyncState(runtime.getState())
        const firstProjection = selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release')
            .find(item => item.sourceReleaseId === firstScene.release.releaseId)
        const firstCursor = firstSyncState?.lastCursor

        if (typeof firstCursor !== 'number' || !firstProjection) {
            throw new Error('missing first scene projection state')
        }

        const secondScene = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [terminalId],
            batchCount: 1,
        })
        expect(secondScene.release?.releaseId).toBeTruthy()

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release').some(item =>
                item.sourceReleaseId === secondScene.release.releaseId,
            )
        }, 5_000)

        const secondSyncState = selectTdpSyncState(runtime.getState())
        const secondProjection = selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release')
            .find(item => item.sourceReleaseId === secondScene.release.releaseId)

        expect(secondProjection).toMatchObject({
            scopeId: terminalId,
            sourceReleaseId: secondScene.release.releaseId,
        })
        expect(secondProjection?.itemKey).not.toBe(firstProjection.itemKey)
        expect(secondProjection?.revision).toBe(1)
        expect(secondSyncState?.lastCursor).toBeGreaterThan(firstCursor)
        expect(secondSyncState?.lastAckedCursor).toBe(secondSyncState?.lastCursor)
        expect(secondSyncState?.lastAppliedCursor).toBe(secondSyncState?.lastCursor)
    })
})
