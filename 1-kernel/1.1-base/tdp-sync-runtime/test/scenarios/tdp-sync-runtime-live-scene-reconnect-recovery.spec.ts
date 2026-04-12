import {afterEach, describe, expect, it} from 'vitest'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionEntriesByTopic,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncParameterDefinitions,
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

describe('tdp-sync-runtime live scene reconnect recovery', () => {
    it('continues scene-driven incremental sync after forced close and reconnect', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
            startupSeed: {
                parameterCatalog: {
                    [tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key]: {
                        key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                        rawValue: 50,
                        updatedAt: Date.now() as any,
                        source: 'host',
                    },
                },
            },
        })

        await runtime.start()
        await activateAndConnectLiveRuntime(runtime, {
            activationCode: '200000000005',
            deviceId: 'device-live-scene-reconnect-001',
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before reconnect recovery scene')
        }

        const firstScene = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [terminalId],
            batchCount: 1,
        })

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release').some(item =>
                item.sourceReleaseId === firstScene.release.releaseId,
            )
        }, 5_000)

        const syncBeforeReconnect = selectTdpSyncState(runtime.getState())
        const cursorBeforeReconnect = syncBeforeReconnect?.lastCursor
        const sessionsBefore = await platform.admin.sessions()
        const firstSession = sessionsBefore[0]
        if (!firstSession?.sessionId || typeof cursorBeforeReconnect !== 'number') {
            throw new Error('missing session or cursor before reconnect recovery scene')
        }

        await platform.admin.forceCloseSession(firstSession.sessionId, {
            code: 1012,
            reason: 'scene-reconnect-test',
        })

        await waitFor(() => {
            const session = selectTdpSessionState(runtime.getState())
            return session?.status === 'READY' && session.sessionId !== firstSession.sessionId
        }, 5_000)

        const reconnectedSession = selectTdpSessionState(runtime.getState())
        expect(reconnectedSession?.syncMode).toBe('incremental')

        const secondScene = await platform.admin.runSceneTemplate('scene-batch-terminal-online', {
            targetTerminalIds: [terminalId],
            batchCount: 1,
        })

        await waitFor(() => {
            return selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release').some(item =>
                item.sourceReleaseId === secondScene.release.releaseId,
            )
        }, 5_000)

        const syncAfterReconnect = selectTdpSyncState(runtime.getState())
        const secondProjection = selectTdpProjectionEntriesByTopic(runtime.getState(), 'tcp.task.release')
            .find(item => item.sourceReleaseId === secondScene.release.releaseId)

        expect(secondProjection).toMatchObject({
            scopeId: terminalId,
            sourceReleaseId: secondScene.release.releaseId,
        })
        expect(syncAfterReconnect?.lastCursor).toBeGreaterThan(cursorBeforeReconnect)
        expect(syncAfterReconnect?.lastAckedCursor).toBe(syncAfterReconnect?.lastCursor)
        expect(syncAfterReconnect?.lastAppliedCursor).toBe(syncAfterReconnect?.lastCursor)
    })
})
