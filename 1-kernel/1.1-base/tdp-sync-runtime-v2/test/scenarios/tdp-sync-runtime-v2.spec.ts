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
    selectTcpBindingSnapshot,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    selectTdpCommandInboxState,
    selectTdpProjectionByTopicAndBucket,
    selectTdpResolvedProjection,
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
            expect(request.input.body).toMatchObject({
                sandboxId: 'sandbox-test-001',
            })
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
            expect(request.input.body).toMatchObject({
                sandboxId: 'sandbox-test-001',
                refreshToken: 'refresh-token-001',
            })
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
    autoConnectOnActivation?: boolean
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
                autoConnectOnActivation: input.autoConnectOnActivation ?? false,
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
                            profile: defineSocketProfile<void, {sandboxId: string; terminalId: string; token: string}, Record<string, string>, any, any>({
                                name: 'kernel.base.tdp-sync-runtime-v2.test.socket',
                                serverName: SERVER_NAME_MOCK_TERMINAL_PLATFORM,
                                pathTemplate: '/api/v1/tdp/ws/connect',
                                handshake: {
                                    query: typed<{sandboxId: string; terminalId: string; token: string}>('kernel.base.tdp-sync-runtime-v2.test.socket.query'),
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
            sandboxId: 'sandbox-test-001',
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
            sandboxId: 'sandbox-test-001',
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

    it('sends handshake after socket connect resolves so transportConnection is ready', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_handshake_after_connect_resolve',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-handshake-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-HANDSHAKE-001',
            deviceFingerprint: 'device-test-handshake-001',
            deviceInfo: {
                id: 'device-test-handshake-001',
                model: 'Mock POS',
            },
        }))

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.connectTdpSession,
            {},
        ))

        expect(result.status).toBe('COMPLETED')
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'HANDSHAKE',
                data: expect.objectContaining({
                    sandboxId: 'sandbox-test-001',
                    terminalId: 'terminal-test-001',
                    appVersion: expect.any(String),
                    protocolVersion: expect.any(String),
                }),
            },
        })
        expect(selectTdpSessionState(runtime.getState())?.status).toBe('HANDSHAKING')
    })

    it('auto connects TDP after terminal activation succeeds', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_auto_connect_after_activation',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            autoConnectOnActivation: true,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-auto-connect-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-AUTO-CONNECT-001',
            deviceFingerprint: 'device-auto-connect-001',
            deviceInfo: {
                id: 'device-auto-connect-001',
                model: 'Mock POS',
            },
        }))

        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'HANDSHAKE',
                data: expect.objectContaining({
                    sandboxId: 'sandbox-test-001',
                    terminalId: 'terminal-test-001',
                }),
            },
        })
        expect(selectTdpSessionState(runtime.getState())?.status).toBe('HANDSHAKING')
    })

    it('auto reconnects TDP on runtime start when activation state was persisted', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const seedRuntime = createRuntime({
            localNodeId: 'node_tdp_v2_auto_reconnect_after_restart',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy: createSocketRuntimeSpy(),
            autoConnectOnActivation: false,
        })

        await seedRuntime.start()
        await seedRuntime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-auto-reconnect-001',
                model: 'Mock POS',
            },
        }))
        await seedRuntime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-AUTO-RECONNECT-001',
            deviceFingerprint: 'device-auto-reconnect-001',
            deviceInfo: {
                id: 'device-auto-reconnect-001',
                model: 'Mock POS',
            },
        }))
        await seedRuntime.flushPersistence()

        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_auto_reconnect_after_restart',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            autoConnectOnActivation: true,
        })

        await runtime.start()

        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'HANDSHAKE',
                data: expect.objectContaining({
                    sandboxId: 'sandbox-test-001',
                    terminalId: 'terminal-test-001',
                }),
            },
        })
        expect(selectTdpSessionState(runtime.getState())?.status).toBe('HANDSHAKING')
    })

    it('fails connectTdpSession when terminal credentials are missing', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_missing_credential',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
            socketRuntimeSpy: createSocketRuntimeSpy(),
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.connectTdpSession,
            {},
        ))

        expect(result.status).toBe('FAILED')
        expect(result.actorResults[0]).toMatchObject({
            status: 'FAILED',
            error: {
                key: 'kernel.base.tdp-sync-runtime-v2.credential_missing',
            },
        })
    })

    it('fails bootstrapTdpSync when tcp credential exists but sandboxId is missing', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        await secureStateStorage.storage.setItem(
            'kernel-runtime-v2:node_tdp_v2_missing_sandbox:secure-state:kernel.base.tcp-control-runtime-v2.credential:accessToken',
            JSON.stringify('access-token-001'),
        )
        await secureStateStorage.storage.setItem(
            'kernel-runtime-v2:node_tdp_v2_missing_sandbox:secure-state:kernel.base.tcp-control-runtime-v2.credential:refreshToken',
            JSON.stringify('refresh-token-001'),
        )
        await stateStorage.storage.setItem(
            'kernel-runtime-v2:node_tdp_v2_missing_sandbox:app-state:kernel.base.tcp-control-runtime-v2.identity:terminalId',
            JSON.stringify('terminal-test-001'),
        )

        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_missing_sandbox',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.bootstrapTdpSync,
            {},
        ))

        expect(result.status).toBe('FAILED')
        expect(result.actorResults[0]).toMatchObject({
            status: 'FAILED',
            error: {
                key: 'kernel.base.tdp-sync-runtime-v2.credential_missing',
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
            sandboxId: 'sandbox-test-001',
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

    it('resolves GROUP scope between store and terminal by membership rank', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_group_scope',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: '123456789012',
            deviceFingerprint: 'device-group-scope',
            deviceInfo: {
                id: 'device-group-scope',
                model: 'Mock POS',
            },
        }))

        const binding = selectTcpBindingSnapshot(runtime.getState())
        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('expected terminal id')
        }

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 4,
            snapshot: [{
            topic: 'config.delta',
            itemKey: 'main',
            operation: 'upsert',
            scopeType: 'STORE',
            scopeId: binding.storeId ?? 'store-test',
            revision: 1,
            payload: {version: 'store'},
            occurredAt: '2026-04-18T00:00:00.000Z',
        }, {
            topic: 'config.delta',
            itemKey: 'main',
            operation: 'upsert',
            scopeType: 'GROUP',
            scopeId: 'group_a',
            revision: 1,
            payload: {version: 'group-a'},
            occurredAt: '2026-04-18T00:00:01.000Z',
        }, {
            topic: 'config.delta',
            itemKey: 'main',
            operation: 'upsert',
            scopeType: 'GROUP',
            scopeId: 'group_b',
            revision: 1,
            payload: {version: 'group-b'},
            occurredAt: '2026-04-18T00:00:02.000Z',
        }, {
            topic: 'terminal.group.membership',
            itemKey: terminalId,
            operation: 'upsert',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            revision: 1,
            payload: {
                membershipVersion: 2,
                groups: [
                    {groupId: 'group_a', rank: 0, priority: 100, matchedBy: {projectId: binding.projectId}},
                    {groupId: 'group_b', rank: 1, priority: 200, matchedBy: {templateId: binding.templateId}},
                ],
            },
            occurredAt: '2026-04-18T00:00:03.000Z',
        }],
        }))

        expect(selectTdpResolvedProjection(runtime.getState(), {
            topic: 'config.delta',
            itemKey: 'main',
        })?.payload.version).toBe('group-b')
    })
})
