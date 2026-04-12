import {describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpSessionState,
    tdpSyncCommandNames,
    tdpSyncParameterDefinitions,
} from '../../src'
import {
    createMemoryStorage,
    createMockTdpTransport,
    createRuntime,
} from '../helpers/runtimeHarness'

const waitFor = async (predicate: () => boolean, timeoutMs = 1_000) => {
    const startedAt = Date.now()
    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

describe('tdp-sync-runtime reconnect', () => {
    it('automatically reconnects and re-sends handshake after socket close', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        let handshakeCount = 0

        const tdpTransport = createMockTdpTransport({
            onHandshake(emit) {
                handshakeCount += 1
                emit({
                    type: 'SESSION_READY',
                    data: {
                        sessionId: `session-${handshakeCount}`,
                        nodeId: 'mock-tdp-node-01',
                        nodeState: 'healthy',
                        highWatermark: handshakeCount,
                        syncMode: handshakeCount === 1 ? 'full' : 'incremental',
                        alternativeEndpoints: [],
                    },
                })
            },
        })

        const runtime = createRuntime({
            localNodeId: 'node_tdp_reconnect',
            stateStorage,
            secureStateStorage,
            tdpTransport,
            startupSeed: {
                parameterCatalog: {
                    [tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key]: {
                        key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                        rawValue: 20,
                        updatedAt: Date.now(),
                        source: 'host',
                    },
                    [tdpSyncParameterDefinitions.tdpReconnectAttempts.key]: {
                        key: tdpSyncParameterDefinitions.tdpReconnectAttempts.key,
                        rawValue: 1,
                        updatedAt: Date.now(),
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
                    id: 'device-test-001',
                    model: 'Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: 'ACT-TDP-RECONNECT-001',
            },
            requestId: createRequestId(),
        })

        await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => handshakeCount === 1)
        expect(selectTdpSessionState(runtime.getState())).toMatchObject({
            status: 'READY',
            sessionId: 'session-1',
        })

        tdpTransport.emitSocketClose('network-drop')

        await waitFor(() => handshakeCount === 2)
        await waitFor(() => selectTdpSessionState(runtime.getState())?.sessionId === 'session-2')

        expect(tdpTransport.getConnectCount()).toBe(2)
        expect(
            tdpTransport.sentMessages.filter(message => message.type === 'HANDSHAKE'),
        ).toHaveLength(2)
        expect(selectTdpSessionState(runtime.getState())).toMatchObject({
            status: 'READY',
            sessionId: 'session-2',
        })
    })
})
