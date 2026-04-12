import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncCommandNames,
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

describe('tdp-sync-runtime live handshake', () => {
    it('connects to real mock-terminal-platform, handshakes, and observes full snapshot state', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await runtime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-live-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })

        const activation = await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000001',
            },
            requestId: createRequestId(),
        })
        expect(activation.status).toBe('completed')

        const connectResult = await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })
        expect(connectResult.status).toBe('completed')

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const session = selectTdpSessionState(runtime.getState())
        const sync = selectTdpSyncState(runtime.getState())
        const projection = selectTdpProjectionState(runtime.getState())

        expect(session).toMatchObject({
            status: 'READY',
            nodeId: 'mock-tdp-node-01',
            syncMode: 'full',
        })
        expect(sync).toMatchObject({
            snapshotStatus: 'ready',
            changesStatus: 'ready',
        })
        expect(projection).toBeDefined()

        const sessions = await platform.admin.sessions()
        expect(sessions.length).toBeGreaterThanOrEqual(1)
        expect(sessions[0]).toMatchObject({
            status: 'CONNECTED',
        })

        const terminals = await platform.admin.terminals()
        expect(terminals.some(item => item.deviceFingerprint === 'device-live-001')).toBe(true)

        const changeLogs = await platform.admin.changeLogs()
        expect(Array.isArray(changeLogs)).toBe(true)
    })
})
