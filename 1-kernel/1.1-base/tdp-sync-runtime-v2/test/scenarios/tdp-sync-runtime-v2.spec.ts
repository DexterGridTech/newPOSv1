import {describe, expect, it} from 'vitest'
import {createNodeId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@impos2/kernel-server-config-v2'
import {
    createHttpRuntime,
    JsonSocketCodec,
    defineSocketProfile,
    typed,
    type HttpTransport,
    type SocketRuntime,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpCommandInboxState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpResolvedProjectionByTopic,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncV2CommandDefinitions,
} from '../../src'
import {
    selectRuntimeShellV2ErrorCatalog,
    selectRuntimeShellV2ParameterCatalog,
} from '@impos2/kernel-base-runtime-shell-v2'
import {resolveTransportServers} from '../../../../test-support/serverConfig'

const createMemoryStorage = () => {
    const saved = new Map<string, string>()
    return {
        saved,
        storage: {
            async getItem(key: string) {
                return saved.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                saved.set(key, value)
            },
            async removeItem(key: string) {
                saved.delete(key)
            },
            async multiGet(keys: readonly string[]) {
                return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
            async getAllKeys() {
                return [...saved.keys()]
            },
        },
    }
}

const createMockTcpTransport = (): HttpTransport => ({
    async execute(request) {
        if (request.endpoint.pathTemplate === '/api/v1/terminals/activate') {
            return {
                data: {
                    success: true,
                    data: {
                        terminalId: 'terminal-test-001',
                        token: 'access-token-001',
                        refreshToken: 'refresh-token-001',
                        expiresIn: 7200,
                        refreshExpiresIn: 30 * 24 * 3600,
                        binding: {
                            platformId: 'platform-test',
                            projectId: 'project-test',
                            brandId: 'brand-test',
                            tenantId: 'tenant-test',
                            storeId: 'store-test',
                        },
                    },
                } as any,
                status: 201,
                statusText: 'Created',
                headers: {},
            }
        }

        if (request.endpoint.pathTemplate === '/api/v1/terminals/token/refresh') {
            return {
                data: {
                    success: true,
                    data: {
                        token: 'access-token-002',
                        expiresIn: 7200,
                    },
                } as any,
                status: 200,
                statusText: 'OK',
                headers: {},
            }
        }

        throw new Error(`Unexpected endpoint: ${request.endpoint.pathTemplate}`)
    },
})

const createSocketRuntimeSpy = () => {
    const sentMessages: unknown[] = []
    const connectionStateByProfile = new Map<string, 'connected' | 'connecting' | 'disconnected'>()

    const socketRuntime: SocketRuntime = {
        registerProfile() {},
        async connect(profileName) {
            connectionStateByProfile.set(profileName, 'connected')
            return {} as any
        },
        send(profileName, message) {
            sentMessages.push({profileName, message})
        },
        disconnect(profileName) {
            connectionStateByProfile.set(profileName, 'disconnected')
        },
        getConnectionState(profileName) {
            return connectionStateByProfile.get(profileName) ?? 'disconnected'
        },
        on() {},
        off() {},
        replaceServers() {},
        getServerCatalog() {
            return {} as any
        },
    }

    return {
        socketRuntime,
        sentMessages,
    }
}

const createRuntime = (input: {
    localNodeId?: string
    stateStorage: ReturnType<typeof createMemoryStorage>
    secureStateStorage: ReturnType<typeof createMemoryStorage>
    socketRuntimeSpy?: ReturnType<typeof createSocketRuntimeSpy>
}) => {
    const socketRuntimeSpy = input.socketRuntimeSpy

    return createKernelRuntimeV2({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.tdp-sync-runtime-v2.test',
                    layer: 'kernel',
                },
            }),
            stateStorage: input.stateStorage.storage,
            secureStateStorage: input.secureStateStorage.storage,
        }),
        modules: [
            createTcpControlRuntimeModuleV2({
                assembly: {
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createMockTcpTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                },
            }),
            createTdpSyncRuntimeModuleV2(socketRuntimeSpy == null ? undefined : {
                assembly: {
                    createHttpRuntime(context: RuntimeModuleContextV2) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime-v2.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createMockTcpTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                    resolveSocketBinding() {
                        return {
                            socketRuntime: socketRuntimeSpy.socketRuntime,
                            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
                            profile: defineSocketProfile<void, {terminalId: string; token: string}, Record<string, string>, any, any>({
                                name: 'kernel.base.tdp-sync-runtime-v2.test.socket',
                                serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
                                pathTemplate: '/api/v1/tdp/ws/connect',
                                handshake: {
                                    query: typed<{terminalId: string; token: string}>('kernel.base.tdp-sync-runtime-v2.test.socket.query'),
                                    headers: typed<Record<string, string>>('kernel.base.tdp-sync-runtime-v2.test.socket.headers'),
                                },
                                messages: {
                                    incoming: typed<any>('kernel.base.tdp-sync-runtime-v2.test.socket.incoming'),
                                    outgoing: typed<any>('kernel.base.tdp-sync-runtime-v2.test.socket.outgoing'),
                                },
                                codec: new JsonSocketCodec<any, any>(),
                                meta: {
                                    reconnectAttempts: 0,
                                },
                            }),
                        }
                    },
                },
            }),
        ],
    })
}

describe('tdp-sync-runtime-v2', () => {
    it('bootstraps automatically from the global runtime initialize lifecycle', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_initialize',
            stateStorage,
            secureStateStorage,
        })

        const observedBootstrapRequests: string[] = []
        runtime.subscribeRequests(request => {
            if (request.commands.some(command => command.commandName === tdpSyncV2CommandDefinitions.bootstrapTdpSync.commandName)) {
                observedBootstrapRequests.push(request.status)
            }
        })

        await runtime.start()

        expect(observedBootstrapRequests).toContain('RUNNING')
        expect(observedBootstrapRequests.at(-1)).toBe('COMPLETED')
        const syncState = selectTdpSyncState(runtime.getState())
        if (syncState == null) {
            throw new Error('expected tdp sync state to exist after runtime start')
        }
        expect(syncState.snapshotStatus).toBe('idle')
        expect(syncState.changesStatus).toBe('idle')
        expect(syncState.lastDeliveredCursor).toBeUndefined()
        expect(syncState.lastAckedCursor).toBeUndefined()
    })

    it('resolves scope priority, publishes effective topic changes, bridges system catalogs, and restores projection repository', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_test',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            activationCode: 'ACT-TDP-V2-001',
            deviceFingerprint: 'device-test-001',
            deviceInfo: {
                id: 'device-test-001',
                model: 'Mock POS',
            },
        }))

        const observedTopicChanges: any[] = []
        runtime.subscribeRequests(request => {
            request.commands
                .filter(command => command.commandName === tdpSyncV2CommandDefinitions.tdpTopicDataChanged.commandName)
                .forEach(command => observedTopicChanges.push(command))
        })

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-001',
                nodeId: 'mock-tdp-node-01',
                nodeState: 'healthy',
                highWatermark: 5,
                syncMode: 'full',
                alternativeEndpoints: [],
            },
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 5,
            snapshot: [
                {
                    topic: 'workflow.definition',
                    itemKey: 'wf-a',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {steps: ['store']},
                    occurredAt: '2026-04-12T12:00:00.000Z',
                },
                {
                    topic: 'workflow.definition',
                    itemKey: 'wf-a',
                    operation: 'upsert' as const,
                    scopeType: 'TERMINAL',
                    scopeId: 'terminal-test-001',
                    revision: 2,
                    payload: {steps: ['terminal']},
                    occurredAt: '2026-04-12T12:00:01.000Z',
                },
                {
                    topic: 'error.message',
                    itemKey: 'err.network',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {template: 'store network error'},
                    occurredAt: '2026-04-12T12:00:02.000Z',
                },
                {
                    topic: 'system.parameter',
                    itemKey: 'payment.timeout.ms',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {value: 5000},
                    occurredAt: '2026-04-12T12:00:03.000Z',
                },
            ],
        }))

        expect(selectTdpSessionState(runtime.getState())).toMatchObject({
            sessionId: 'session-001',
            nodeId: 'mock-tdp-node-01',
            syncMode: 'full',
        })
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            snapshotStatus: 'ready',
            changesStatus: 'ready',
            lastCursor: 5,
            lastAppliedCursor: 5,
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'workflow.definition',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'wf-a',
        })).toMatchObject({
            payload: {steps: ['store']},
        })
        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'workflow.definition')).toMatchObject({
            'wf-a': {
                payload: {steps: ['terminal']},
                scopeType: 'TERMINAL',
            },
        })
        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.network']).toMatchObject({
            template: 'store network error',
        })
        expect(selectRuntimeShellV2ParameterCatalog(runtime.getState())['payment.timeout.ms']).toMatchObject({
            rawValue: 5000,
        })

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 6,
            change: {
                topic: 'workflow.definition',
                itemKey: 'wf-a',
                operation: 'delete' as const,
                scopeType: 'TERMINAL',
                scopeId: 'terminal-test-001',
                revision: 3,
                payload: {},
                occurredAt: '2026-04-12T12:01:00.000Z',
            },
        }))

        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'workflow.definition')).toMatchObject({
            'wf-a': {
                payload: {steps: ['store']},
                scopeType: 'STORE',
            },
        })

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 7,
            change: {
                topic: 'error.message',
                itemKey: 'err.network',
                operation: 'delete' as const,
                scopeType: 'STORE',
                scopeId: 'store-test',
                revision: 2,
                payload: {},
                occurredAt: '2026-04-12T12:01:01.000Z',
            },
        }))

        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.network']).toBeUndefined()
        expect(observedTopicChanges.length).toBeGreaterThan(0)

        await runtime.flushPersistence()

        const persistedKeys = [...stateStorage.saved.keys()]
        expect(persistedKeys.some(key => key.endsWith(':kernel.base.tdp-sync-runtime-v2.sync:lastCursor'))).toBe(true)
        expect(persistedKeys.some(key => key.endsWith(':kernel.base.tdp-sync-runtime-v2.sync:lastAppliedCursor'))).toBe(true)
        expect(persistedKeys.some(key => key.includes('kernel.base.tdp-sync-runtime-v2.projection:entries:workflow.definition:STORE:store-test:wf-a'))).toBe(true)

        const restoredRuntime = createRuntime({
            localNodeId: 'node_tdp_v2_test',
            stateStorage,
            secureStateStorage,
        })
        await restoredRuntime.start()

        expect(selectTdpSyncState(restoredRuntime.getState())).toMatchObject({
            lastCursor: 7,
            lastAppliedCursor: 7,
            lastDeliveredCursor: undefined,
            lastAckedCursor: undefined,
        })
        expect(selectTdpResolvedProjectionByTopic(restoredRuntime.getState(), 'workflow.definition')).toMatchObject({
            'wf-a': {
                payload: {steps: ['store']},
            },
        })
    })

    it('auto acknowledges delivered remote commands with command id and instance id', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_command_ack',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-ack-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            activationCode: 'ACT-TDP-V2-ACK-001',
            deviceFingerprint: 'device-test-ack-001',
            deviceInfo: {
                id: 'device-test-ack-001',
                model: 'Mock POS',
            },
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-ack-001',
            nodeId: 'mock-tdp-node-ack',
            nodeState: 'healthy',
            highWatermark: 12,
            syncMode: 'incremental',
            alternativeEndpoints: [],
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
            nextCursor: 12,
            highWatermark: 12,
            changes: [],
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, {
            commandId: 'cmd-ack-001',
            topic: 'remote.control',
            terminalId: 'terminal-test-001',
            sourceReleaseId: 'release-ack-001',
            expiresAt: '2026-04-13T23:59:59.000Z',
            payload: {
                instanceId: 'instance-ack-001',
                commandType: 'SYNC_ORDER',
                action: 'SYNC_ORDER',
            },
        }))

        expect(selectTdpCommandInboxState(runtime.getState())?.orderedIds).toContain('cmd-ack-001')
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 12,
                    topic: 'remote.control',
                    itemKey: 'cmd-ack-001',
                    instanceId: 'instance-ack-001',
                },
            },
        })
    })

    it('auto acknowledges and reports applied cursor for projection stream messages', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_projection_feedback',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-feedback-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            activationCode: 'ACT-TDP-V2-FEEDBACK-001',
            deviceFingerprint: 'device-test-feedback-001',
            deviceInfo: {
                id: 'device-test-feedback-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-feedback-001',
            nodeId: 'mock-tdp-node-feedback',
            nodeState: 'healthy',
            highWatermark: 4,
            syncMode: 'full',
            alternativeEndpoints: [],
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 4,
            snapshot: [],
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 5,
            change: {
                topic: 'config.delta',
                itemKey: 'cfg-feedback-001',
                operation: 'upsert',
                scopeType: 'TERMINAL',
                scopeId: 'terminal-test-001',
                revision: 5,
                payload: {
                    featureFlag: true,
                },
                occurredAt: '2026-04-13T01:00:00.000Z',
            },
        }))

        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 4,
                },
            },
        })
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'STATE_REPORT',
                data: {
                    lastAppliedCursor: 4,
                    connectionMetrics: undefined,
                    localStoreMetrics: undefined,
                },
            },
        })
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 5,
                },
            },
        })
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'STATE_REPORT',
                data: {
                    lastAppliedCursor: 5,
                    connectionMetrics: undefined,
                    localStoreMetrics: undefined,
                },
            },
        })
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 5,
            lastAckedCursor: 5,
            lastAppliedCursor: 5,
        })
    })
})
