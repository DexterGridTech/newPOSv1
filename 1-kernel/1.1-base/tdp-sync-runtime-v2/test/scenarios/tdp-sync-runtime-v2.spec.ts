import {describe, expect, it} from 'vitest'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {createNodeId} from '@next/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@next/kernel-base-platform-ports'
import {
    createCommand,
    createKernelRuntimeV2,
    createModuleActorFactory,
    onCommand,
    type RuntimeModuleContextV2,
    type KernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@next/kernel-server-config-v2'
import {
    createHttpRuntime,
    JsonSocketCodec,
    defineSocketProfile,
    typed,
    type HttpSuccessResponse,
    type HttpTransport,
    type HttpTransportRequest,
    type SocketRuntime,
} from '@next/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpCredentialSnapshot,
    selectTcpBindingSnapshot,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    createTdpSyncRuntimeModuleV2,
    buildHotUpdateVersionReportPayload,
    selectTdpHotUpdateState,
    selectTdpCommandInboxState,
    selectTdpControlSignalsState,
    selectTdpActiveProjectionEntries,
    selectTdpProjectionByTopicAndBucket,
    selectTdpProjectionState,
    selectTdpResolvedProjection,
    selectTdpResolvedProjectionByTopic,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncV2CommandDefinitions,
    computeTdpSubscriptionHash,
    TDP_SUBSCRIPTION_HASH_CAPABILITY_V1,
    TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1,
    TDP_SNAPSHOT_CHUNK_CAPABILITY_V1,
    TDP_HOT_UPDATE_TOPIC,
    toTopicFingerprintV2,
    type TdpTopicDataChangedPayload,
} from '../../src'
import {
    selectRuntimeShellV2ErrorCatalog,
    selectRuntimeShellV2ParameterCatalog,
} from '@next/kernel-base-runtime-shell-v2'
import {resolveTransportServers} from '../../../../test-support/serverConfig'

const TEST_TOPIC_CHANGE_RECORDER_SLICE = 'kernel.base.tdp-sync-runtime-v2.test.topic-change-recorder'

const selectRecordedTopicChanges = (state: Record<string, unknown>) =>
    (state[TEST_TOPIC_CHANGE_RECORDER_SLICE] as TdpTopicDataChangedPayload[] | undefined) ?? []

const createTopicChangeRecorderModule = (): KernelRuntimeModuleV2 => {
    const slice = createSlice({
        name: TEST_TOPIC_CHANGE_RECORDER_SLICE,
        initialState: [] as TdpTopicDataChangedPayload[],
        reducers: {
            record(state, action: PayloadAction<TdpTopicDataChangedPayload>) {
                state.push(action.payload)
            },
        },
    })
    const defineActor = createModuleActorFactory('kernel.base.tdp-sync-runtime-v2.test.topic-change-recorder')
    return {
        moduleName: 'kernel.base.tdp-sync-runtime-v2.test.topic-change-recorder',
        packageVersion: '0.0.1',
        stateSlices: [
            {
                name: TEST_TOPIC_CHANGE_RECORDER_SLICE,
                reducer: slice.reducer,
                persistIntent: 'never',
            },
        ],
        actorDefinitions: [
            defineActor('TopicChangeRecorderActor', [
                onCommand(tdpSyncV2CommandDefinitions.tdpTopicDataChanged, context => {
                    context.dispatchAction(slice.actions.record(context.command.payload))
                    return {
                        topic: context.command.payload.topic,
                        changeCount: context.command.payload.changes.length,
                    }
                }),
            ]),
        ],
    }
}

const createTopicInterestModule = (
    interests: NonNullable<KernelRuntimeModuleV2['tdpTopicInterests']>,
): KernelRuntimeModuleV2 => ({
    moduleName: 'kernel.base.tdp-sync-runtime-v2.test.topic-interest',
    packageVersion: '0.0.1',
    tdpTopicInterests: interests,
})

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

const createControlledMemoryStorage = () => {
    const saved = new Map<string, string>()
    let blockNextMultiSet = false
    let pendingMultiSet:
        | {
            entries: Readonly<Record<string, string>>
            resolve: () => void
        }
        | undefined
    const waitForPendingMultiSet = async () => {
        for (let index = 0; index < 100; index += 1) {
            if (pendingMultiSet) {
                return pendingMultiSet
            }
            await Promise.resolve()
        }
        throw new Error('Timed out waiting for pending multiSet')
    }

    return {
        saved,
        blockNextMultiSet() {
            blockNextMultiSet = true
        },
        waitForPendingMultiSet,
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
                if (!blockNextMultiSet) {
                    Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
                    return
                }
                blockNextMultiSet = false
                if (pendingMultiSet) {
                    throw new Error('Unexpected concurrent pending multiSet')
                }
                await new Promise<void>(resolve => {
                    pendingMultiSet = {
                        entries,
                        resolve() {
                            Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
                            pendingMultiSet = undefined
                            resolve()
                        },
                    }
                })
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

describe('tdp-sync-runtime-v2 hot update version reporter', () => {
    it('derives standalone slave display role from topology runtime state', () => {
        const report = buildHotUpdateVersionReportPayload({
            'kernel.base.tcp-control-runtime-v2.identity': {
                terminalId: 'terminal-001',
                activationStatus: 'ACTIVATED',
            },
            'kernel.base.tcp-control-runtime-v2.sandbox': {
                sandboxId: 'sandbox-001',
            },
            'kernel.base.topology-runtime-v3.context': {
                localNodeId: 'master:slave-node',
                displayIndex: 0,
                displayCount: 1,
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                workspace: 'MAIN',
                standalone: true,
                enableSlave: false,
            },
            'kernel.base.tdp-sync-runtime-v2.hot-update': {
                current: {
                    source: 'hot-update',
                    appId: 'assembly-android-mixc-retail-rn84',
                    assemblyVersion: '1.0.0',
                    buildNumber: 8,
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    bundleVersion: '1.0.0+ota.6',
                    packageId: 'pkg-001',
                    releaseId: 'release-001',
                    appliedAt: 123,
                },
                history: [],
            },
        }, {
            appId: 'assembly-android-mixc-retail-rn84',
            assemblyVersion: '1.0.0',
            buildNumber: 8,
            runtimeVersion: 'android-mixc-retail-rn84@1.0',
            displayIndex: 0,
            displayRole: 'single',
            state: 'RUNNING',
        })

        expect(report).toMatchObject({
            terminalId: 'terminal-001',
            sandboxId: 'sandbox-001',
            payload: {
                displayIndex: 0,
                displayRole: 'secondary',
                bundleVersion: '1.0.0+ota.6',
                source: 'hot-update',
                packageId: 'pkg-001',
                releaseId: 'release-001',
            },
        })
    })

    it('derives paired master display role as primary from topology runtime state', () => {
        const report = buildHotUpdateVersionReportPayload({
            'kernel.base.tcp-control-runtime-v2.identity': {
                terminalId: 'terminal-002',
                activationStatus: 'ACTIVATED',
            },
            'kernel.base.tcp-control-runtime-v2.sandbox': {
                sandboxId: 'sandbox-002',
            },
            'kernel.base.topology-runtime-v3.context': {
                localNodeId: 'master:primary-node',
                displayIndex: 0,
                displayCount: 1,
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                workspace: 'MAIN',
                standalone: true,
                enableSlave: true,
            },
            'kernel.base.tdp-sync-runtime-v2.hot-update': {
                current: {
                    source: 'hot-update',
                    appId: 'assembly-android-mixc-retail-rn84',
                    assemblyVersion: '1.0.0',
                    buildNumber: 8,
                    runtimeVersion: 'android-mixc-retail-rn84@1.0',
                    bundleVersion: '1.0.0+ota.7',
                    packageId: 'pkg-002',
                    releaseId: 'release-002',
                    appliedAt: 456,
                },
                history: [],
            },
        }, {
            appId: 'assembly-android-mixc-retail-rn84',
            assemblyVersion: '1.0.0',
            buildNumber: 8,
            runtimeVersion: 'android-mixc-retail-rn84@1.0',
            displayIndex: 0,
            displayRole: 'single',
            state: 'RUNNING',
        })

        expect(report).toMatchObject({
            terminalId: 'terminal-002',
            sandboxId: 'sandbox-002',
            payload: {
                displayIndex: 0,
                displayRole: 'primary',
                bundleVersion: '1.0.0+ota.7',
                source: 'hot-update',
                packageId: 'pkg-002',
                releaseId: 'release-002',
            },
        })
    })
})

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

const toSuccessResponse = <TResponse>(data: TResponse): HttpSuccessResponse<TResponse> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
})

const createSocketRuntimeSpy = () => {
    const sentMessages: unknown[] = []
    const disconnects: Array<{profileName: string; reason?: string}> = []
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
        disconnect(profileName, reason) {
            disconnects.push({profileName, reason})
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
        disconnects,
    }
}

const createTdpHttpTransportSpy = (input?: {
    onExecute?(request: HttpTransportRequest<any, any, any>): void
}): HttpTransport & {
    requests: HttpTransportRequest<any, any, any>[]
} => {
    const requests: HttpTransportRequest<any, any, any>[] = []

    return {
        requests,
        async execute(request) {
            requests.push(request)
            input?.onExecute?.(request)

            if (request.endpoint.pathTemplate === '/api/v1/terminals/activate') {
                return toSuccessResponse({
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
                } as any)
            }

            if (request.endpoint.pathTemplate === '/api/v1/terminals/token/refresh') {
                return toSuccessResponse({
                    success: true,
                    data: {
                        token: 'access-token-002',
                        expiresIn: 7200,
                    },
                } as any)
            }

            if (request.endpoint.pathTemplate === '/api/v1/tdp/terminals/{terminalId}/changes') {
                const query = request.input.query as {
                    cursor?: number
                    limit?: number
                    subscribedTopics?: string
                } | undefined
                const cursor = Number(query?.cursor ?? 0)
                return toSuccessResponse({
                    success: true,
                    data: cursor === 10
                        ? {
                            terminalId: 'terminal-test-001',
                            changes: [
                                {
                                    topic: 'org.store.profile',
                                    itemKey: 'store-page-2',
                                    operation: 'upsert',
                                    scopeType: 'STORE',
                                    scopeId: 'store-test',
                                    revision: 11,
                                    payload: {name: 'Second Page Store'},
                                    occurredAt: '2026-04-28T10:00:11.000Z',
                                },
                            ],
                            nextCursor: 11,
                            hasMore: false,
                            highWatermark: 11,
                        }
                        : {
                            terminalId: 'terminal-test-001',
                            changes: [],
                            nextCursor: cursor,
                            hasMore: false,
                            highWatermark: cursor,
                        },
                } as any)
            }

            throw new Error(`Unexpected endpoint: ${request.endpoint.pathTemplate}`)
        },
    }
}

const createRuntime = (input: {
    localNodeId?: string
    stateStorage: {
        storage: ReturnType<typeof createMemoryStorage>['storage']
    }
    secureStateStorage: {
        storage: ReturnType<typeof createMemoryStorage>['storage']
    }
    socketRuntimeSpy?: ReturnType<typeof createSocketRuntimeSpy>
    tdpHttpTransport?: HttpTransport
    autoConnectOnActivation?: boolean
    extraModules?: readonly KernelRuntimeModuleV2[]
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
                            transport: input.tdpHttpTransport ?? createMockTcpTransport(),
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
            ...(input.extraModules ?? []),
            createTopicChangeRecorderModule(),
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

    it('reconciles hot update desired with injected current facts so allowed channel can download', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createKernelRuntimeV2({
            localNodeId: 'node_tdp_v2_hot_update_channel' as any,
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
                stateStorage: stateStorage.storage,
                secureStateStorage: secureStateStorage.storage,
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
                createTdpSyncRuntimeModuleV2({
                    hotUpdate: {
                        getCurrentFacts() {
                            return {
                                appId: 'assembly-android-mixc-retail-rn84',
                                platform: 'android' as const,
                                product: 'mixc-retail',
                                runtimeVersion: 'android-mixc-retail-rn84@1.0',
                                assemblyVersion: '1.0.0',
                                buildNumber: 1,
                                channel: 'development',
                                capabilities: [],
                            }
                        },
                    },
                }),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-hot-update-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-HOT-UPDATE-001',
            deviceFingerprint: 'device-hot-update-001',
            deviceInfo: {
                id: 'device-hot-update-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 1,
            snapshot: [
                {
                    topic: 'terminal.hot-update.desired',
                    itemKey: 'main',
                    operation: 'upsert' as const,
                    scopeType: 'TERMINAL',
                    scopeId: 'terminal-test-001',
                    revision: 1,
                    payload: {
                        schemaVersion: 1,
                        releaseId: 'release-hot-update',
                        packageId: 'package-hot-update',
                        appId: 'assembly-android-mixc-retail-rn84',
                        platform: 'android',
                        product: 'mixc-retail',
                        bundleVersion: '1.0.0+ota.9',
                        runtimeVersion: 'android-mixc-retail-rn84@1.0',
                        packageUrl: '/api/v1/hot-updates/packages/package-hot-update/download',
                        packageSize: 1024,
                        packageSha256: 'package-sha',
                        manifestSha256: 'manifest-sha',
                        compatibility: {
                            appId: 'assembly-android-mixc-retail-rn84',
                            platform: 'android',
                            product: 'mixc-retail',
                            runtimeVersion: 'android-mixc-retail-rn84@1.0',
                            allowedChannels: ['development'],
                        },
                        restart: {mode: 'manual'},
                        rollout: {mode: 'active', publishedAt: '2026-04-20T00:00:00.000Z'},
                        safety: {
                            requireSignature: false,
                            maxDownloadAttempts: 3,
                            maxLaunchFailures: 2,
                            healthCheckTimeoutMs: 5000,
                        },
                    },
                    occurredAt: '2026-04-20T00:00:00.000Z',
                },
            ],
        }))

        expect(selectTdpHotUpdateState(runtime.getState())).toMatchObject({
            desired: {
                packageId: 'package-hot-update',
            },
            candidate: {
                packageId: 'package-hot-update',
                status: 'download-pending',
            },
        })
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
                    sourceReleaseId: 'release-store-wf-a',
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
                    sourceReleaseId: 'release-terminal-wf-a',
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
                sourceReleaseId: 'release-terminal-wf-a-delete',
            },
        }))

        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'workflow.definition')).toMatchObject({
            'wf-a': {
                payload: {steps: ['store']},
                scopeType: 'STORE',
            },
        })
        const resolvedWorkflowBeforeUnrelatedChange = selectTdpResolvedProjectionByTopic(
            runtime.getState(),
            'workflow.definition',
        )

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
                sourceReleaseId: 'release-store-error-delete',
            },
        }))

        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.network']).toBeUndefined()
        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'workflow.definition')).toBe(
            resolvedWorkflowBeforeUnrelatedChange,
        )
        const observedTopicChanges = selectRecordedTopicChanges(runtime.getState())
        expect(observedTopicChanges.length).toBeGreaterThan(0)
        const workflowChanges = observedTopicChanges
            .filter(payload => payload.topic === 'workflow.definition')
        expect(workflowChanges[0]?.changes).toContainEqual(expect.objectContaining({
            operation: 'upsert',
            itemKey: 'wf-a',
            revision: 2,
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            sourceReleaseId: 'release-terminal-wf-a',
            occurredAt: '2026-04-12T12:00:01.000Z',
            payload: {steps: ['terminal']},
        }))
        expect(workflowChanges[1]?.changes).toContainEqual(expect.objectContaining({
            operation: 'upsert',
            itemKey: 'wf-a',
            revision: 1,
            scopeType: 'STORE',
            scopeId: 'store-test',
            sourceReleaseId: 'release-store-wf-a',
            occurredAt: '2026-04-12T12:00:00.000Z',
            payload: {steps: ['store']},
        }))
        const errorChanges = observedTopicChanges
            .filter(payload => payload.topic === 'error.message')
        expect(errorChanges.at(-1)?.changes).toContainEqual(expect.objectContaining({
            operation: 'delete',
            itemKey: 'err.network',
            revision: 1,
            scopeType: 'STORE',
            scopeId: 'store-test',
            occurredAt: '2026-04-12T12:00:02.000Z',
        }))

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

    it('sends resolved topic subscription in handshake and resets cursor when subscription hash changes', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_handshake_topic_subscription',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            extraModules: [
                createTopicInterestModule([
                    {
                        topicKey: 'org.store.profile',
                        required: true,
                        reason: 'reason is documentation only',
                    },
                    {
                        topicKey: 'catering.product',
                        reason: 'product data',
                    },
                    {
                        topicKey: 'org.store.profile',
                        required: false,
                        reason: 'duplicate keeps required true',
                    },
                ]),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-subscription-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-SUBSCRIPTION-001',
            deviceFingerprint: 'device-test-subscription-001',
            deviceInfo: {
                id: 'device-test-subscription-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-subscription-old',
            nodeId: 'mock-tdp-node-subscription',
            nodeState: 'healthy',
            highWatermark: 18,
            syncMode: 'incremental',
            alternativeEndpoints: [],
            subscription: {
                version: 1,
                mode: 'explicit',
                hash: 'fnv1a64:previous',
                acceptedTopics: ['org.store.profile'],
                rejectedTopics: [],
                requiredMissingTopics: [],
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
            nextCursor: 18,
            highWatermark: 18,
            changes: [],
        }))

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.connectTdpSession,
            {},
        ))

        const expectedHash = computeTdpSubscriptionHash([
            {topicKey: 'catering.product'},
            {topicKey: 'config.delta'},
            {topicKey: 'error.message'},
            {topicKey: 'org.store.profile'},
            {topicKey: 'system.parameter'},
            {topicKey: 'terminal.group.membership'},
            {topicKey: TDP_HOT_UPDATE_TOPIC},
        ])
        expect(result.status).toBe('COMPLETED')
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'HANDSHAKE',
                data: expect.objectContaining({
                    sandboxId: 'sandbox-test-001',
                    terminalId: 'terminal-test-001',
                    subscribedTopics: [
                        'catering.product',
                        'config.delta',
                        'error.message',
                        'org.store.profile',
                        'system.parameter',
                        'terminal.group.membership',
                        TDP_HOT_UPDATE_TOPIC,
                    ],
                    requiredTopics: [
                        'error.message',
                        'org.store.profile',
                        'system.parameter',
                        'terminal.group.membership',
                        TDP_HOT_UPDATE_TOPIC,
                    ],
                    subscriptionHash: expectedHash,
                    subscriptionMode: 'explicit',
                    subscriptionVersion: 1,
                    capabilities: [
                        TDP_TOPIC_SUBSCRIPTION_CAPABILITY_V1,
                        TDP_SUBSCRIPTION_HASH_CAPABILITY_V1,
                        TDP_SNAPSHOT_CHUNK_CAPABILITY_V1,
                    ],
                    lastCursor: undefined,
                }),
            },
        })
        expect(computeTdpSubscriptionHash([
            {topicKey: 'org.store.profile'},
            {topicKey: 'catering.product'},
            {topicKey: 'config.delta'},
            {topicKey: 'error.message'},
            {topicKey: 'system.parameter'},
            {topicKey: 'terminal.group.membership'},
            {topicKey: TDP_HOT_UPDATE_TOPIC},
        ])).toBe(expectedHash)
        expect(computeTdpSubscriptionHash([
            {topicKey: 'catering.product'},
            {topicKey: 'org.store.profile'},
            {topicKey: 'config.delta'},
            {topicKey: 'error.message'},
            {topicKey: 'system.parameter'},
            {topicKey: 'terminal.group.membership'},
            {topicKey: TDP_HOT_UPDATE_TOPIC},
        ])).toBe(expectedHash)
    })

    it('reuses cursor with previous accepted subscription hash when server rejects optional topics', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const acceptedHash = computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}])
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_previous_accepted_subscription_hash',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            extraModules: [
                createTopicInterestModule([
                    {topicKey: 'org.store.profile'},
                    {topicKey: 'catering.product'},
                ]),
            ],
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-accepted-subscription-hash',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-ACCEPTED-SUBSCRIPTION',
            deviceFingerprint: 'device-test-accepted-subscription-hash',
            deviceInfo: {
                id: 'device-test-accepted-subscription-hash',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.connectTdpSession,
            {},
        ))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-accepted-subscription-old',
            nodeId: 'mock-tdp-node-subscription',
            nodeState: 'healthy',
            highWatermark: 18,
            syncMode: 'incremental',
            alternativeEndpoints: [],
            subscription: {
                version: 1,
                mode: 'explicit',
                hash: acceptedHash,
                acceptedTopics: ['org.store.profile'],
                rejectedTopics: ['catering.product'],
                requiredMissingTopics: [],
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
            nextCursor: 18,
            highWatermark: 18,
            changes: [],
        }))

        socketRuntimeSpy.sentMessages.length = 0
        await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.disconnectTdpSession,
            {},
        ))
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
                    lastCursor: 18,
                    previousAcceptedSubscriptionHash: acceptedHash,
                    previousAcceptedTopics: ['org.store.profile'],
                }),
            },
        })
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

    it('disconnects the previous TDP session on reset so a later activation re-handshakes cleanly', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_reconnect_after_reset',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            autoConnectOnActivation: true,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-reconnect-after-reset-001',
                model: 'Mock POS',
            },
        }))

        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-RESET-001',
            deviceFingerprint: 'device-reconnect-after-reset-001',
            deviceInfo: {
                id: 'device-reconnect-after-reset-001',
                model: 'Mock POS',
            },
        }))

        const firstHandshakeCount = socketRuntimeSpy.sentMessages.filter(item =>
            (item as any).message?.type === 'HANDSHAKE',
        ).length
        expect(firstHandshakeCount).toBe(1)

        await runtime.dispatchCommand(createCommand(
            tcpControlV2CommandDefinitions.resetTcpControl,
            {},
        ))

        expect(socketRuntimeSpy.socketRuntime.getConnectionState('kernel.base.tdp-sync-runtime-v2.test.socket'))
            .toBe('disconnected')

        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-RESET-002',
            deviceFingerprint: 'device-reconnect-after-reset-001',
            deviceInfo: {
                id: 'device-reconnect-after-reset-001',
                model: 'Mock POS',
            },
        }))

        const handshakeCountAfterReset = socketRuntimeSpy.sentMessages.filter(item =>
            (item as any).message?.type === 'HANDSHAKE',
        ).length
        expect(handshakeCountAfterReset).toBe(2)
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

    it('clears TDP cursor and retained projection repository when tcp control resets for rebind', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_reset_rebind',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
            autoConnectOnActivation: true,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-reset-rebind-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-RESET-REBIND-001',
            deviceFingerprint: 'device-reset-rebind-001',
            deviceInfo: {
                id: 'device-reset-rebind-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-reset-rebind-001',
            nodeId: 'mock-tdp-node-reset-rebind',
            nodeState: 'healthy',
            highWatermark: 9,
            syncMode: 'incremental',
            alternativeEndpoints: [],
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 9,
            snapshot: [{
                topic: 'config.delta',
                itemKey: 'cfg-reset-rebind-001',
                operation: 'upsert',
                scopeType: 'TERMINAL',
                scopeId: 'terminal-test-001',
                revision: 9,
                payload: {version: 'before-reset'},
                occurredAt: '2026-04-24T00:00:00.000Z',
            }],
        }))

        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 9,
            lastAppliedCursor: 9,
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'config.delta',
            scopeType: 'TERMINAL',
            scopeId: 'terminal-test-001',
            itemKey: 'cfg-reset-rebind-001',
        })?.payload.version).toBe('before-reset')
        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'config.delta')).toMatchObject({
            'cfg-reset-rebind-001': {
                payload: {version: 'before-reset'},
            },
        })

        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.resetTcpControl, {}))

        expect(selectTdpSessionState(runtime.getState())?.status).toBe('IDLE')
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            snapshotStatus: 'idle',
            changesStatus: 'idle',
            lastCursor: undefined,
            lastDeliveredCursor: undefined,
            lastAckedCursor: undefined,
            lastAppliedCursor: undefined,
        })
        expect(selectTdpActiveProjectionEntries(runtime.getState())).toEqual({})
        expect(selectTdpProjectionState(runtime.getState())).toMatchObject({
            activeEntries: {},
            stagedEntries: undefined,
        })
        expect(selectTdpResolvedProjectionByTopic(runtime.getState(), 'config.delta')).toEqual({})
        expect(selectTdpCommandInboxState(runtime.getState())?.orderedIds ?? []).toEqual([])
        expect(socketRuntimeSpy.disconnects).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            reason: 'command-disconnect',
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

    it.each([
        ['TOKEN_EXPIRED', '终端 token 已过期'],
        ['INVALID_TOKEN', '终端 token 无效'],
    ])('refreshes tcp credential when tdp protocol reports %s', async (code, message) => {
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: `node_tdp_v2_refresh_on_${code.toLowerCase()}`,
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
            socketRuntimeSpy,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-token-expired-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-TOKEN-EXPIRED-001',
            deviceFingerprint: 'device-test-token-expired-001',
            deviceInfo: {
                id: 'device-test-token-expired-001',
                model: 'Mock POS',
            },
        }))

        const result = await runtime.dispatchCommand(createCommand(
            tdpSyncV2CommandDefinitions.tdpProtocolFailed,
            {
                code,
                message,
                details: {
                    code,
                },
            },
        ))

        expect(result.status).toBe('COMPLETED')
        expect(selectTdpSessionState(runtime.getState())).toMatchObject({
            status: 'ERROR',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            accessToken: 'access-token-002',
            refreshToken: 'refresh-token-001',
            status: 'READY',
        })
        expect(socketRuntimeSpy.disconnects).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            reason: `credential-protocol-error:${code}`,
        })
        expect(runtime.queryRequest(result.requestId ?? '')?.commands.map(item => item.commandName)).toEqual([
            tdpSyncV2CommandDefinitions.tdpProtocolFailed.commandName,
            tcpControlV2CommandDefinitions.refreshCredential.commandName,
            tcpControlV2CommandDefinitions.credentialRefreshed.commandName,
        ])
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
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, {
            batchId: 'batch-feedback-001',
            receivedAt: Date.now(),
            nextCursor: 6,
            changes: [
                {
                    topic: 'config.delta',
                    itemKey: 'cfg-feedback-002',
                    operation: 'upsert',
                    scopeType: 'TERMINAL',
                    scopeId: 'terminal-test-001',
                    revision: 6,
                    payload: {
                        featureFlag: false,
                    },
                    occurredAt: '2026-04-13T01:00:01.000Z',
                },
            ],
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
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'BATCH_ACK',
                data: {
                    nextCursor: 6,
                    batchId: 'batch-feedback-001',
                    processingLagMs: expect.any(Number),
                    subscriptionHash: undefined,
                },
            },
        })
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 6,
                },
            },
        })
        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'STATE_REPORT',
                data: {
                    lastAppliedCursor: 6,
                    connectionMetrics: undefined,
                    localStoreMetrics: undefined,
                },
            },
        })
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 6,
            lastAckedCursor: 6,
            lastAppliedCursor: 6,
        })
    })

    it('delays projection ACK until projection state is flushed to persistent storage', async () => {
        const stateStorage = createControlledMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const socketRuntimeSpy = createSocketRuntimeSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_projection_feedback_barrier',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-FEEDBACK-BARRIER-001',
            deviceFingerprint: 'device-test-feedback-barrier-001',
            deviceInfo: {
                id: 'device-test-feedback-barrier-001',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, {
            sessionId: 'session-feedback-barrier-001',
            nodeId: 'mock-tdp-node-feedback-barrier',
            nodeState: 'healthy',
            highWatermark: 4,
            syncMode: 'incremental',
            alternativeEndpoints: [],
        }))
        socketRuntimeSpy.sentMessages.length = 0
        stateStorage.blockNextMultiSet()

        const projectionDispatch = runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 7,
            change: {
                topic: 'config.delta',
                itemKey: 'cfg-feedback-barrier-001',
                operation: 'upsert',
                scopeType: 'TERMINAL',
                scopeId: 'terminal-test-001',
                revision: 7,
                payload: {
                    featureFlag: true,
                },
                occurredAt: '2026-04-28T13:00:00.000Z',
            },
        }))

        const pendingMultiSet = await stateStorage.waitForPendingMultiSet()
        expect(socketRuntimeSpy.sentMessages).not.toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 7,
                },
            },
        })

        pendingMultiSet.resolve()
        await projectionDispatch

        expect(socketRuntimeSpy.sentMessages).toContainEqual({
            profileName: 'kernel.base.tdp-sync-runtime-v2.test.socket',
            message: {
                type: 'ACK',
                data: {
                    cursor: 7,
                },
            },
        })
    })

    it('filters unsubscribed projection topics before writing local repository', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_subscription_filter',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-FILTER-001',
            deviceFingerprint: 'device-subscription-filter',
            deviceInfo: {
                id: 'device-subscription-filter',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-filter-001',
                nodeId: 'mock-tdp-node-filter',
                nodeState: 'healthy',
                highWatermark: 10,
                syncMode: 'full',
                alternativeEndpoints: [],
                subscription: {
                    version: 1,
                    mode: 'explicit',
                    hash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
                    acceptedTopics: ['org.store.profile'],
                    rejectedTopics: [],
                    requiredMissingTopics: [],
                },
            },
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'FULL_SNAPSHOT',
            data: {
                terminalId: 'terminal-test-001',
                highWatermark: 10,
                snapshot: [
                    {
                        topic: 'org.store.profile',
                        itemKey: 'store-a',
                        operation: 'upsert' as const,
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 1,
                        payload: {name: 'Allowed Store'},
                        occurredAt: '2026-04-28T00:00:00.000Z',
                    },
                    {
                        topic: 'catering.product',
                        itemKey: 'sku-a',
                        operation: 'upsert' as const,
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 1,
                        payload: {name: 'Rejected Product'},
                        occurredAt: '2026-04-28T00:00:01.000Z',
                    },
                ],
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'PROJECTION_CHANGED',
            eventId: 'evt-filter-rejected-001',
            timestamp: 1,
            data: {
                cursor: 11,
                change: {
                    topic: 'catering.product',
                    itemKey: 'sku-b',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 2,
                    payload: {name: 'Rejected Stream Product'},
                    occurredAt: '2026-04-28T00:00:02.000Z',
                },
            },
        }))

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-a',
        })).toMatchObject({
            payload: {name: 'Allowed Store'},
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'catering.product',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'sku-a',
        })).toBeUndefined()
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'catering.product',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'sku-b',
        })).toBeUndefined()
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 10,
            activeSubscribedTopics: ['org.store.profile'],
        })
    })

    it('records a protocol failure when SESSION_READY reports required missing topics', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_required_missing_topics',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()
        const result = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-required-missing-001',
                nodeId: 'mock-tdp-node-required-missing',
                nodeState: 'healthy',
                highWatermark: 1,
                syncMode: 'full',
                alternativeEndpoints: [],
                subscription: {
                    version: 1,
                    mode: 'explicit',
                    hash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
                    acceptedTopics: ['org.store.profile'],
                    rejectedTopics: ['catering.product'],
                    requiredMissingTopics: ['catering.product'],
                },
            },
        }))

        expect(runtime.queryRequest(result.requestId)?.commands.map(item => item.commandName)).toContain(
            tdpSyncV2CommandDefinitions.tdpProtocolFailed.commandName,
        )
        expect(selectTdpControlSignalsState(runtime.getState())?.lastProtocolError).toMatchObject({
            code: 'kernel.base.tdp-sync-runtime-v2.protocol_error',
            details: {
                requiredMissingTopics: ['catering.product'],
            },
        })
    })

    it('buffers chunked snapshots and applies them only after SNAPSHOT_END', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_chunked_snapshot',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-CHUNKED-SNAPSHOT-001',
            deviceFingerprint: 'device-chunked-snapshot',
            deviceInfo: {
                id: 'device-chunked-snapshot',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-chunked-snapshot-001',
                nodeId: 'mock-tdp-node-chunked-snapshot',
                nodeState: 'healthy',
                highWatermark: 12,
                syncMode: 'full',
                alternativeEndpoints: [],
                subscription: {
                    version: 1,
                    mode: 'explicit',
                    hash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
                    acceptedTopics: ['org.store.profile'],
                    rejectedTopics: [],
                    requiredMissingTopics: [],
                },
            },
        }))

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_BEGIN',
            data: {
                terminalId: 'terminal-test-001',
                snapshotId: 'snapshot-chunked-001',
                totalChunks: 2,
                totalItems: 2,
                highWatermark: 12,
                subscriptionHash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_CHUNK',
            data: {
                snapshotId: 'snapshot-chunked-001',
                chunkIndex: 0,
                items: [
                    {
                        topic: 'org.store.profile',
                        itemKey: 'store-chunk-a',
                        operation: 'upsert',
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 11,
                        payload: {name: 'Chunk Store A'},
                        occurredAt: '2026-04-28T11:00:00.000Z',
                    },
                ],
            },
        }))

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-chunk-a',
        })).toBeUndefined()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_CHUNK',
            data: {
                snapshotId: 'snapshot-chunked-001',
                chunkIndex: 1,
                items: [
                    {
                        topic: 'org.store.profile',
                        itemKey: 'store-chunk-b',
                        operation: 'upsert',
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 12,
                        payload: {name: 'Chunk Store B'},
                        occurredAt: '2026-04-28T11:00:01.000Z',
                    },
                    {
                        topic: 'catering.product',
                        itemKey: 'sku-chunk-rejected',
                        operation: 'upsert',
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 1,
                        payload: {name: 'Rejected Product'},
                        occurredAt: '2026-04-28T11:00:02.000Z',
                    },
                ],
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_END',
            data: {
                snapshotId: 'snapshot-chunked-001',
            },
        }))

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-chunk-a',
        })).toMatchObject({
            payload: {name: 'Chunk Store A'},
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-chunk-b',
        })).toMatchObject({
            payload: {name: 'Chunk Store B'},
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'catering.product',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'sku-chunk-rejected',
        })).toBeUndefined()
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 12,
            snapshotStatus: 'ready',
        })
    })

    it('rejects incomplete chunked snapshots without committing partial data or cursor', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_incomplete_chunked_snapshot',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-INCOMPLETE-CHUNKED-SNAPSHOT',
            deviceFingerprint: 'device-incomplete-chunked-snapshot',
            deviceInfo: {
                id: 'device-incomplete-chunked-snapshot',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-incomplete-chunked-snapshot-001',
                nodeId: 'mock-tdp-node-incomplete-chunked-snapshot',
                nodeState: 'healthy',
                highWatermark: 30,
                syncMode: 'full',
                alternativeEndpoints: [],
                subscription: {
                    version: 1,
                    mode: 'explicit',
                    hash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
                    acceptedTopics: ['org.store.profile'],
                    rejectedTopics: [],
                    requiredMissingTopics: [],
                },
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_BEGIN',
            data: {
                terminalId: 'terminal-test-001',
                snapshotId: 'snapshot-incomplete-001',
                totalChunks: 2,
                totalItems: 2,
                highWatermark: 30,
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_CHUNK',
            data: {
                snapshotId: 'snapshot-incomplete-001',
                chunkIndex: 0,
                items: [
                    {
                        topic: 'org.store.profile',
                        itemKey: 'store-incomplete-a',
                        operation: 'upsert',
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 30,
                        payload: {name: 'Incomplete Store A'},
                        occurredAt: '2026-04-28T12:00:00.000Z',
                    },
                ],
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SNAPSHOT_END',
            data: {
                snapshotId: 'snapshot-incomplete-001',
            },
        }))

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-incomplete-a',
        })).toBeUndefined()
        expect(selectTdpSyncState(runtime.getState())?.lastCursor).toBeUndefined()
        expect(selectTdpControlSignalsState(runtime.getState())?.lastProtocolError).toMatchObject({
            details: {
                code: 'TDP_SNAPSHOT_CHUNKS_INCOMPLETE',
            },
        })
    })

    it('applies large snapshots through hidden staging chunks before publishing the new active repository', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_large_snapshot_apply',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-LARGE-SNAPSHOT-001',
            deviceFingerprint: 'device-large-snapshot',
            deviceInfo: {
                id: 'device-large-snapshot',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 1,
            snapshot: [
                {
                    topic: 'org.store.profile',
                    itemKey: 'store-existing',
                    operation: 'upsert',
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {name: 'Existing Store'},
                    occurredAt: '2026-04-28T13:00:00.000Z',
                },
            ],
        }))

        const snapshot = Array.from({length: 205}, (_, index) => ({
            topic: 'org.store.profile',
            itemKey: `store-large-${index}`,
            operation: 'upsert' as const,
            scopeType: 'STORE',
            scopeId: 'store-test',
            revision: index + 2,
            payload: {name: `Large Store ${index}`},
            occurredAt: `2026-04-28T13:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        }))

        const beginResult = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.beginSnapshotApply, {
            snapshotId: 'manual-large-snapshot',
            highWatermark: 205,
            totalItems: snapshot.length,
        }))
        expect(beginResult.status).toBe('COMPLETED')
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.applySnapshotChunk, {
            snapshotId: 'manual-large-snapshot',
            chunkIndex: 0,
            items: snapshot.slice(0, 100),
        }))

        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            snapshotStatus: 'applying',
            applyingSnapshotId: 'manual-large-snapshot',
            applyingSnapshotAppliedItems: 100,
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-existing',
        })).toMatchObject({
            payload: {name: 'Existing Store'},
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-large-0',
        })).toBeUndefined()

        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.applySnapshotChunk, {
            snapshotId: 'manual-large-snapshot',
            chunkIndex: 1,
            items: snapshot.slice(100, 200),
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.applySnapshotChunk, {
            snapshotId: 'manual-large-snapshot',
            chunkIndex: 2,
            items: snapshot.slice(200),
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.commitSnapshotApply, {
            snapshotId: 'manual-large-snapshot',
            highWatermark: 205,
        }))

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-existing',
        })).toBeUndefined()
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-large-204',
        })).toMatchObject({
            payload: {name: 'Large Store 204'},
        })
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            snapshotStatus: 'ready',
            lastCursor: 205,
            lastAppliedCursor: 205,
            applyingSnapshotId: undefined,
        })

        const result = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 410,
            snapshot,
        }))
        const commandNames = runtime.queryRequest(result.requestId)?.commands.map(item => item.commandName) ?? []
        expect(commandNames.filter(name => name === tdpSyncV2CommandDefinitions.applySnapshotChunk.commandName)).toHaveLength(3)
        expect(commandNames).toContain(tdpSyncV2CommandDefinitions.snapshotApplyCompleted.commandName)
    })

    it('keeps 1000 item snapshot apply within the local smoke performance budget', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_snapshot_performance_smoke',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-SNAPSHOT-PERF-001',
            deviceFingerprint: 'device-snapshot-performance-smoke',
            deviceInfo: {
                id: 'device-snapshot-performance-smoke',
                model: 'Mock POS',
            },
        }))

        const snapshot = Array.from({length: 1000}, (_, index) => ({
            topic: 'org.store.profile',
            itemKey: `store-perf-${index}`,
            operation: 'upsert' as const,
            scopeType: 'STORE',
            scopeId: 'store-test',
            revision: index + 1,
            payload: {name: `Performance Store ${index}`},
            occurredAt: '2026-04-28T14:00:00.000Z',
        }))

        const startedAt = performance.now()
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 1000,
            snapshot,
        }))
        const elapsedMs = performance.now() - startedAt

        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 1000,
            snapshotStatus: 'ready',
        })
        expect(selectTdpActiveProjectionEntries(runtime.getState())).toHaveProperty(
            'org.store.profile:STORE:store-test:store-perf-999',
        )
        expect(elapsedMs).toBeLessThan(1000)
    })

    it('uses revision metadata for topic fingerprints instead of payload stringify order', () => {
        const first = toTopicFingerprintV2({
            a: {
                topic: 'org.store.profile',
                itemKey: 'store-a',
                operation: 'upsert',
                scopeType: 'STORE',
                scopeId: 'store-test',
                revision: 5,
                payload: {a: 1, b: 2},
                occurredAt: '2026-04-28T12:00:00.000Z',
            },
        })
        const sameRevisionDifferentPayloadOrder = toTopicFingerprintV2({
            a: {
                topic: 'org.store.profile',
                itemKey: 'store-a',
                operation: 'upsert',
                scopeType: 'STORE',
                scopeId: 'store-test',
                revision: 5,
                payload: {b: 2, a: 1},
                occurredAt: '2026-04-28T12:00:00.000Z',
            },
        })
        const nextRevision = toTopicFingerprintV2({
            a: {
                topic: 'org.store.profile',
                itemKey: 'store-a',
                operation: 'upsert',
                scopeType: 'STORE',
                scopeId: 'store-test',
                revision: 6,
                payload: {a: 1, b: 2},
                occurredAt: '2026-04-28T12:00:00.000Z',
            },
        })

        expect(first).toBe(sameRevisionDifferentPayloadOrder)
        expect(first).not.toBe(nextRevision)
    })

    it('recomputes topic changes only for realtime changed topics unless group membership changes', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_changed_topic_recompute',
            stateStorage,
            secureStateStorage,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-CHANGED-TOPIC-001',
            deviceFingerprint: 'device-changed-topic',
            deviceInfo: {
                id: 'device-changed-topic',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
            highWatermark: 2,
            snapshot: [
                {
                    topic: 'org.store.profile',
                    itemKey: 'store-a',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {name: 'Store A'},
                    occurredAt: '2026-04-28T12:00:00.000Z',
                },
                {
                    topic: 'catering.product',
                    itemKey: 'sku-a',
                    operation: 'upsert' as const,
                    scopeType: 'STORE',
                    scopeId: 'store-test',
                    revision: 1,
                    payload: {name: 'SKU A'},
                    occurredAt: '2026-04-28T12:00:01.000Z',
                },
            ],
        }))

        const initialCount = selectRecordedTopicChanges(runtime.getState()).length
        const projectionResult = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 3,
            change: {
                topic: 'org.store.profile',
                itemKey: 'store-a',
                operation: 'upsert' as const,
                scopeType: 'STORE',
                scopeId: 'store-test',
                revision: 2,
                payload: {name: 'Store A v2'},
                occurredAt: '2026-04-28T12:00:02.000Z',
            },
        }))

        expect(runtime.queryRequest(projectionResult.requestId)?.commands.map(item => item.commandName)).toContain(
            tdpSyncV2CommandDefinitions.recomputeChangedTopicChanges.commandName,
        )
        expect(runtime.queryRequest(projectionResult.requestId)?.commands.map(item => item.commandName)).not.toContain(
            tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges.commandName,
        )
        expect(selectRecordedTopicChanges(runtime.getState()).slice(initialCount)).toEqual([
            expect.objectContaining({
                topic: 'org.store.profile',
                changes: [
                    expect.objectContaining({
                        itemKey: 'store-a',
                        revision: 2,
                    }),
                ],
            }),
        ])

        const membershipResult = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
            cursor: 4,
            change: {
                topic: 'terminal.group.membership',
                itemKey: 'terminal-test-001',
                operation: 'upsert' as const,
                scopeType: 'TERMINAL',
                scopeId: 'terminal-test-001',
                revision: 1,
                payload: {membershipVersion: 1, groups: []},
                occurredAt: '2026-04-28T12:00:03.000Z',
            },
        }))

        expect(runtime.queryRequest(membershipResult.requestId)?.commands.map(item => item.commandName)).toContain(
            tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges.commandName,
        )
    })

    it('fetches remaining changes over HTTP with the active subscription when CHANGESET has more pages', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const tdpHttpTransport = createTdpHttpTransportSpy()
        const runtime = createRuntime({
            localNodeId: 'node_tdp_v2_fetch_more_changes',
            stateStorage,
            secureStateStorage,
            socketRuntimeSpy: createSocketRuntimeSpy(),
            tdpHttpTransport,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TDP-V2-FETCH-MORE-001',
            deviceFingerprint: 'device-fetch-more',
            deviceInfo: {
                id: 'device-fetch-more',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'SESSION_READY',
            data: {
                sessionId: 'session-fetch-more-001',
                nodeId: 'mock-tdp-node-fetch-more',
                nodeState: 'healthy',
                highWatermark: 11,
                syncMode: 'incremental',
                alternativeEndpoints: [],
                subscription: {
                    version: 1,
                    mode: 'explicit',
                    hash: computeTdpSubscriptionHash([{topicKey: 'org.store.profile'}]),
                    acceptedTopics: ['org.store.profile'],
                    rejectedTopics: [],
                    requiredMissingTopics: [],
                },
            },
        }))

        const changesResult = await runtime.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, {
            type: 'CHANGESET',
            data: {
                terminalId: 'terminal-test-001',
                nextCursor: 10,
                highWatermark: 11,
                hasMore: true,
                changes: [
                    {
                        topic: 'org.store.profile',
                        itemKey: 'store-page-1',
                        operation: 'upsert',
                        scopeType: 'STORE',
                        scopeId: 'store-test',
                        revision: 10,
                        payload: {name: 'First Page Store'},
                        occurredAt: '2026-04-28T10:00:10.000Z',
                    },
                ],
            },
        }))
        expect(changesResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(changesResult.requestId)?.commands.map(command => ({
            commandName: command.commandName,
            status: command.status,
        }))).toEqual(expect.arrayContaining([
            expect.objectContaining({
                commandName: tdpSyncV2CommandDefinitions.fetchMoreChanges.commandName,
                status: 'COMPLETED',
            }),
            expect.objectContaining({
                commandName: tdpSyncV2CommandDefinitions.tdpChangesLoaded.commandName,
                status: 'COMPLETED',
            }),
        ]))
        expect(tdpHttpTransport.requests.some(request =>
            request.endpoint.pathTemplate === '/api/v1/tdp/terminals/{terminalId}/changes',
        )).toBe(true)

        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-page-1',
        })).toMatchObject({
            payload: {name: 'First Page Store'},
        })
        expect(selectTdpProjectionByTopicAndBucket(runtime.getState(), {
            topic: 'org.store.profile',
            scopeType: 'STORE',
            scopeId: 'store-test',
            itemKey: 'store-page-2',
        })).toMatchObject({
            payload: {name: 'Second Page Store'},
        })
        expect(tdpHttpTransport.requests.some(request =>
            request.endpoint.pathTemplate === '/api/v1/tdp/terminals/{terminalId}/changes'
            && request.input.query?.cursor === 10
            && request.input.query?.subscribedTopics === 'org.store.profile',
        )).toBe(true)
        expect(selectTdpSyncState(runtime.getState())).toMatchObject({
            lastCursor: 11,
            changesStatus: 'ready',
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
