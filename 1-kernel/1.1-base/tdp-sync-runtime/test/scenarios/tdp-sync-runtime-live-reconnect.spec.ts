import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpControlSignalsState,
    selectTdpProjectionEntriesByTopic,
    selectTdpProjectionState,
    selectTdpSessionState,
    tdpSyncCommandNames,
    tdpSyncParameterDefinitions,
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

describe('tdp-sync-runtime live reconnect', () => {
    it('reconnects to real mock-terminal-platform after forced close and continues receiving projection updates', async () => {
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
        await runtime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-live-reconnect-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000003',
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
        const firstSession = sessionsBefore[0]
        if (!firstSession?.sessionId) {
            throw new Error('missing first live session')
        }

        await platform.admin.forceCloseSession(firstSession.sessionId, {
            code: 1012,
            reason: 'test-reconnect',
        })

        await waitFor(() => {
            const session = selectTdpSessionState(runtime.getState())
            return session?.status === 'READY' && session.sessionId !== firstSession.sessionId
        }, 5_000)

        const sessionAfterReconnect = selectTdpSessionState(runtime.getState())
        expect(sessionAfterReconnect?.sessionId).not.toBe(firstSession.sessionId)

        const liveSessions = await platform.admin.sessions()
        const activeSession = liveSessions.find(item => item.sessionId === sessionAfterReconnect?.sessionId)
        if (!activeSession?.terminalId) {
            throw new Error('missing reconnected session on server')
        }

        await platform.admin.upsertProjection({
            topicKey: 'terminal.config.state',
            scopeType: 'TERMINAL',
            scopeKey: activeSession.terminalId,
            itemKey: 'terminal-config-reconnected-001',
            payload: {
                configVersion: 'config-reconnected-001',
                mode: 'resume',
            },
        })

        await waitFor(() => {
            const projectionEntries = selectTdpProjectionEntriesByTopic(runtime.getState(), 'terminal.config.state')
            return projectionEntries.some(item =>
                item.payload.configVersion === 'config-reconnected-001',
            )
        })

        const projectionState = selectTdpProjectionState(runtime.getState())
        const reconnectSignal = selectTdpControlSignalsState(runtime.getState())
        expect(selectTdpProjectionEntriesByTopic(runtime.getState(), 'terminal.config.state').some(item =>
            item.payload.configVersion === 'config-reconnected-001',
        )).toBe(true)
        expect(reconnectSignal?.lastDisconnectReason).toBe('test-reconnect')
        expect(Object.keys(projectionState ?? {}).length).toBeGreaterThan(0)
    })
})
