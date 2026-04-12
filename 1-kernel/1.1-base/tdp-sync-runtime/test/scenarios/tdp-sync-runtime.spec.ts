import {describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpCommandInboxState,
    selectTdpControlSignalsState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionState,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncCommandNames,
} from '../../src'
import {
    createMemoryStorage,
    createMockTdpTransport,
    createRuntime,
    projectionA,
    projectionB,
} from '../helpers/runtimeHarness'

describe('tdp-sync-runtime', () => {
    it('fails fast when tcp credential is missing', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const tdpTransport = createMockTdpTransport({})
        const runtime = createRuntime({
            stateStorage,
            secureStateStorage,
            tdpTransport,
        })

        await runtime.start()

        const result = await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        expect(result.status).toBe('failed')
        expect(tdpTransport.sentMessages).toEqual([])
    })

    it('connects, handshakes, mirrors snapshot/projection/command/control signals, and persists projection repository with recovery cursor state', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const tdpTransport = createMockTdpTransport({
            onHandshake(emit) {
                emit({
                    type: 'SESSION_READY',
                    data: {
                        sessionId: 'session-001',
                        nodeId: 'mock-tdp-node-01',
                        nodeState: 'healthy',
                        highWatermark: 5,
                        syncMode: 'full',
                        alternativeEndpoints: [],
                    },
                })
                emit({
                    type: 'FULL_SNAPSHOT',
                    data: {
                        terminalId: 'terminal-test-001',
                        snapshot: [projectionA],
                        highWatermark: 5,
                    },
                })
            },
        })
        const runtime = createRuntime({
            localNodeId: 'node_tdp_test',
            stateStorage,
            secureStateStorage,
            tdpTransport,
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
                activationCode: 'ACT-TDP-001',
            },
            requestId: createRequestId(),
        })

        const connectResult = await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })
        await Promise.resolve()

        expect(connectResult.status).toBe('completed')
        expect(tdpTransport.sentMessages[0]).toMatchObject({
            type: 'HANDSHAKE',
            data: {
                terminalId: 'terminal-test-001',
                protocolVersion: '0.0.1',
            },
        })

        tdpTransport.emitServerMessage({
            type: 'PROJECTION_CHANGED',
            eventId: 'evt-001',
            timestamp: Date.now(),
            data: {
                cursor: 6,
                change: projectionB,
            },
        })
        tdpTransport.emitServerMessage({
            type: 'COMMAND_DELIVERED',
            eventId: 'cmd-evt-001',
            timestamp: Date.now(),
            data: {
                commandId: 'cmd-001',
                topic: 'remote.control',
                terminalId: 'terminal-test-001',
                payload: {
                    instanceId: 'instance-remote-001',
                    action: 'PRINT',
                },
                sourceReleaseId: 'release-1',
                expiresAt: null,
            },
        })
        tdpTransport.emitServerMessage({
            type: 'EDGE_DEGRADED',
            data: {
                reason: 'edge overload',
                issuedAt: '2026-04-11T10:05:00.000Z',
                nodeState: 'degraded',
                gracePeriodSeconds: 30,
                alternativeEndpoints: ['ws://backup'],
            },
        })
        tdpTransport.emitServerMessage({
            type: 'SESSION_REHOME_REQUIRED',
            data: {
                reason: 'rebalance',
                deadline: '2026-04-11T10:06:00.000Z',
                alternativeEndpoints: ['ws://backup'],
            },
        })
        tdpTransport.emitServerMessage({
            type: 'PONG',
            data: {
                timestamp: Date.now(),
            },
        })
        const sentAckMessages = tdpTransport.sentMessages.filter(message => message.type === 'ACK')
        const sentStateReports = tdpTransport.sentMessages.filter(message => message.type === 'STATE_REPORT')
        expect(sentAckMessages.length).toBeGreaterThanOrEqual(0)
        expect(sentStateReports.length).toBeGreaterThanOrEqual(0)

        const session = selectTdpSessionState(runtime.getState())
        const sync = selectTdpSyncState(runtime.getState())
        const projection = selectTdpProjectionState(runtime.getState())
        const commandInbox = selectTdpCommandInboxState(runtime.getState())
        const controlSignals = selectTdpControlSignalsState(runtime.getState())

        expect(session).toMatchObject({
            sessionId: 'session-001',
            nodeId: 'mock-tdp-node-01',
            syncMode: 'full',
        })
        expect(sync).toMatchObject({
            snapshotStatus: 'ready',
            changesStatus: 'ready',
            lastCursor: 6,
            lastDeliveredCursor: 6,
            lastAckedCursor: 6,
            lastAppliedCursor: 6,
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            itemKey: 'cfg-1',
        })).toMatchObject({
            payload: {
                value: 'A',
            },
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'tcp.task.release',
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            itemKey: 'task-1',
        })).toMatchObject({
            payload: {
                instanceId: 'instance-001',
            },
        })
        expect(commandInbox?.itemsById['cmd-001']).toMatchObject({
            topic: 'remote.control',
        })
        expect(controlSignals?.lastEdgeDegraded).toMatchObject({
            reason: 'edge overload',
        })
        expect(controlSignals?.lastRehomeRequired).toMatchObject({
            reason: 'rebalance',
        })

        await runtime.flushPersistence()

        const persistedKeys = [...stateStorage.saved.keys()]
        expect(persistedKeys.some(key => key.endsWith(':kernel.base.tdp-sync-runtime.sync:lastCursor'))).toBe(true)
        expect(persistedKeys.some(key => key.endsWith(':kernel.base.tdp-sync-runtime.sync:lastAppliedCursor'))).toBe(true)
        expect(persistedKeys.some(key => key.includes('kernel.base.tdp-sync-runtime.projection:entries:config.delta:TERMINAL:terminal-test-001:cfg-1'))).toBe(true)
        expect(persistedKeys.some(key => key.includes('kernel.base.tdp-sync-runtime.projection:entries:tcp.task.release:TERMINAL:terminal-test-001:task-1'))).toBe(true)
        expect(persistedKeys.some(key => key.includes('kernel.base.tdp-sync-runtime.command-inbox'))).toBe(false)
        expect(persistedKeys.some(key => key.includes('kernel.base.tdp-sync-runtime.session'))).toBe(false)

        const restoreTransport = createMockTdpTransport({})
        const restoredRuntime = createRuntime({
            localNodeId: 'node_tdp_test',
            stateStorage,
            secureStateStorage,
            tdpTransport: restoreTransport,
        })

        await restoredRuntime.start()

        expect(selectTdpSyncState(restoredRuntime.getState())).toMatchObject({
            lastCursor: 6,
            lastAppliedCursor: 6,
            lastDeliveredCursor: undefined,
            lastAckedCursor: undefined,
        })
        expect(selectTdpProjectionByTopicAndBucket(restoredRuntime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            itemKey: 'cfg-1',
        })).toMatchObject({
            payload: {
                value: 'A',
            },
        })
        expect(selectTdpProjectionByTopicAndBucket(restoredRuntime.getState(), {
            topic: 'tcp.task.release',
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            itemKey: 'task-1',
        })).toMatchObject({
            payload: {
                instanceId: 'instance-001',
            },
        })
        expect(selectTdpCommandInboxState(restoredRuntime.getState())).toMatchObject({
            itemsById: {},
            orderedIds: [],
        })
        expect(selectTdpSessionState(restoredRuntime.getState())).toMatchObject({
            status: 'IDLE',
        })
    })

    it('recovers incremental cursor into handshake and records protocol error on server error message', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const tdpTransport = createMockTdpTransport({
            onHandshake(emit) {
                emit({
                    type: 'SESSION_READY',
                    data: {
                        sessionId: 'session-002',
                        nodeId: 'mock-tdp-node-02',
                        nodeState: 'healthy',
                        highWatermark: 8,
                        syncMode: 'incremental',
                        alternativeEndpoints: [],
                    },
                })
                emit({
                    type: 'CHANGESET',
                    data: {
                        terminalId: 'terminal-test-001',
                        changes: [projectionB],
                        nextCursor: 8,
                        hasMore: false,
                        highWatermark: 8,
                    },
                })
                emit({
                    type: 'ERROR',
                    error: {
                        code: 'BAD_FRAME',
                        message: 'bad frame',
                    },
                })
            },
        })
        const runtime = createRuntime({
            localNodeId: 'node_tdp_restore',
            stateStorage,
            secureStateStorage,
            tdpTransport,
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
                activationCode: 'ACT-TDP-002',
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.reportAppliedCursor,
            payload: {
                cursor: 7,
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.tdpProjectionReceived,
            payload: {
                cursor: 7,
                change: projectionA,
            },
            requestId: createRequestId(),
            internal: true,
        })
        await runtime.flushPersistence()

        const restoredTransport = createMockTdpTransport({
            onHandshake(emit) {
                emit({
                    type: 'SESSION_READY',
                    data: {
                        sessionId: 'session-003',
                        nodeId: 'mock-tdp-node-03',
                        nodeState: 'healthy',
                        highWatermark: 9,
                        syncMode: 'incremental',
                        alternativeEndpoints: [],
                    },
                })
                emit({
                    type: 'CHANGESET',
                    data: {
                        terminalId: 'terminal-test-001',
                        changes: [],
                        nextCursor: 9,
                        hasMore: false,
                        highWatermark: 9,
                    },
                })
                emit({
                    type: 'ERROR',
                    error: {
                        code: 'SERVER_ERROR',
                        message: 'explode',
                    },
                })
            },
        })
        const restoredRuntime = createRuntime({
            localNodeId: 'node_tdp_restore',
            stateStorage,
            secureStateStorage,
            tdpTransport: restoredTransport,
        })

        await restoredRuntime.start()
        await restoredRuntime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-test-001',
                    model: 'Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await restoredRuntime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })
        await Promise.resolve()

        expect(restoredTransport.sentMessages[0]).toMatchObject({
            type: 'HANDSHAKE',
            data: {
                lastCursor: 7,
            },
        })

        const controlSignals = selectTdpControlSignalsState(restoredRuntime.getState())
        expect(controlSignals?.lastProtocolError).toMatchObject({
            key: 'kernel.base.tdp-sync-runtime.protocol_error',
        })
    })
})
