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

describe('tdp-sync-runtime live scene multi terminal', () => {
    it('delivers the same scene-driven projection release to multiple online terminals and advances both runtimes independently', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const firstHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_live_multi_terminal_1',
        })
        const secondHarness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            localNodeId: 'node_tdp_live_multi_terminal_2',
        })

        await firstHarness.runtime.start()
        await secondHarness.runtime.start()

        await activateAndConnectLiveRuntime(firstHarness.runtime, {
            activationCode: '200000000007',
            deviceId: 'device-live-scene-multi-001',
        })
        await activateAndConnectLiveRuntime(secondHarness.runtime, {
            activationCode: '200000000008',
            deviceId: 'device-live-scene-multi-002',
        })

        await waitFor(() => selectTdpSessionState(firstHarness.runtime.getState())?.status === 'READY')
        await waitFor(() => selectTdpSessionState(secondHarness.runtime.getState())?.status === 'READY')

        const firstTerminalId = selectTcpTerminalId(firstHarness.runtime.getState())
        const secondTerminalId = selectTcpTerminalId(secondHarness.runtime.getState())
        if (!firstTerminalId || !secondTerminalId) {
            throw new Error('missing terminal ids before multi terminal scene run')
        }

        const firstCursorBefore = selectTdpSyncState(firstHarness.runtime.getState())?.lastCursor ?? 0
        const secondCursorBefore = selectTdpSyncState(secondHarness.runtime.getState())?.lastCursor ?? 0

        const sceneResult = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [firstTerminalId, secondTerminalId],
            batchCount: 2,
        })

        expect(sceneResult.release?.releaseId).toBeTruthy()
        expect(sceneResult.targetTerminalIds).toEqual([firstTerminalId, secondTerminalId])

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(firstHarness.runtime.getState(), 'tcp.task.release').some(item =>
                item.scopeId === firstTerminalId
                && item.sourceReleaseId === sceneResult.release.releaseId,
            )
        }, 5_000)

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(secondHarness.runtime.getState(), 'tcp.task.release').some(item =>
                item.scopeId === secondTerminalId
                && item.sourceReleaseId === sceneResult.release.releaseId,
            )
        }, 5_000)

        const firstProjection = selectTdpProjectionEntriesByTopic(firstHarness.runtime.getState(), 'tcp.task.release').find(item =>
            item.scopeId === firstTerminalId
            && item.sourceReleaseId === sceneResult.release.releaseId,
        )
        const secondProjection = selectTdpProjectionEntriesByTopic(secondHarness.runtime.getState(), 'tcp.task.release').find(item =>
            item.scopeId === secondTerminalId
            && item.sourceReleaseId === sceneResult.release.releaseId,
        )

        expect(firstProjection).toMatchObject({
            scopeId: firstTerminalId,
            sourceReleaseId: sceneResult.release.releaseId,
        })
        expect(secondProjection).toMatchObject({
            scopeId: secondTerminalId,
            sourceReleaseId: sceneResult.release.releaseId,
        })

        const firstSyncAfter = selectTdpSyncState(firstHarness.runtime.getState())
        const secondSyncAfter = selectTdpSyncState(secondHarness.runtime.getState())

        expect(firstSyncAfter?.lastCursor).toBeGreaterThan(firstCursorBefore)
        expect(secondSyncAfter?.lastCursor).toBeGreaterThan(secondCursorBefore)
        expect(firstSyncAfter?.lastAckedCursor).toBe(firstSyncAfter?.lastCursor)
        expect(secondSyncAfter?.lastAckedCursor).toBe(secondSyncAfter?.lastCursor)
        expect(firstSyncAfter?.lastAppliedCursor).toBe(firstSyncAfter?.lastCursor)
        expect(secondSyncAfter?.lastAppliedCursor).toBe(secondSyncAfter?.lastCursor)

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            const firstMatched = taskInstances.find(item =>
                item.releaseId === sceneResult.release.releaseId
                && item.terminalId === firstTerminalId,
            )
            const secondMatched = taskInstances.find(item =>
                item.releaseId === sceneResult.release.releaseId
                && item.terminalId === secondTerminalId,
            )
            return Boolean(
                firstMatched
                && secondMatched
                && ['DELIVERED', 'ACKED'].includes(firstMatched.deliveryStatus)
                && ['DELIVERED', 'ACKED'].includes(secondMatched.deliveryStatus),
            )
        }, 5_000)

        const taskInstances = await platform.admin.taskInstances()
        const matchedInstances = taskInstances.filter(item =>
            item.releaseId === sceneResult.release.releaseId
            && (item.terminalId === firstTerminalId || item.terminalId === secondTerminalId),
        )

        expect(matchedInstances).toHaveLength(2)
        expect(matchedInstances.every(item => ['DELIVERED', 'ACKED'].includes(item.deliveryStatus))).toBe(true)
    })
})
