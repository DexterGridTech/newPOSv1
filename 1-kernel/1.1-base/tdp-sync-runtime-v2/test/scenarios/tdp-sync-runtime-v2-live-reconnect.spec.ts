import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpControlSignalsState,
    selectTdpProjectionEntriesByTopic,
    selectTdpSessionState,
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

describe('tdp-sync-runtime-v2 live reconnect', () => {
    it('reconnects to mock-terminal-platform after forced close and continues receiving projection updates', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
            tdp: {
                socket: {
                    reconnectAttempts: 3,
                    reconnectIntervalMs: 50,
                },
            },
        })

        await runtime.start()
        await activateLiveTerminal(runtime, '200000000003', 'device-live-tdp-v2-reconnect-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        const sessionsBefore = await platform.admin.sessions()
        const firstSession = sessionsBefore[0]
        if (!firstSession?.sessionId) {
            throw new Error('missing first live session')
        }

        await platform.admin.forceCloseSession(firstSession.sessionId, {
            code: 1012,
            reason: 'test-reconnect-v2',
        })

        await waitFor(() => {
            const session = selectTdpSessionState(runtime.getState())
            return session?.status === 'READY' && session.sessionId !== firstSession.sessionId
        }, 8_000)

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id after reconnect')
        }

        await platform.admin.upsertProjection({
            topicKey: 'terminal.config.state',
            scopeType: 'TERMINAL',
            scopeKey: terminalId,
            itemKey: 'terminal-config-v2-reconnected-001',
            payload: {
                configVersion: 'config-v2-reconnected-001',
                mode: 'resume',
            },
        })

        await waitFor(() => {
            const projectionEntries = selectTdpProjectionEntriesByTopic(runtime.getState(), 'terminal.config.state')
            return projectionEntries.some(item =>
                item.payload.configVersion === 'config-v2-reconnected-001',
            )
        }, 5_000)

        const sessionAfterReconnect = selectTdpSessionState(runtime.getState())
        expect(sessionAfterReconnect?.sessionId).not.toBe(firstSession.sessionId)
        expect(selectTdpControlSignalsState(runtime.getState())?.lastDisconnectReason).toBe('test-reconnect-v2')
        expect(selectTdpProjectionEntriesByTopic(runtime.getState(), 'terminal.config.state').some(item =>
            item.payload.configVersion === 'config-v2-reconnected-001',
        )).toBe(true)
    })
})
