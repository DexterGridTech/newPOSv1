import {describe, expect, it} from 'vitest'
import {createNodeId, createRequestId} from '@next/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@next/kernel-base-platform-ports'
import {
    applySliceSyncDiff,
    createSliceSyncDiff,
    createSliceSyncSummary,
} from '@next/kernel-base-state-runtime'
import {
    createCommand,
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {kernelBaseTestServerConfig} from '@next/kernel-server-config-v2'
import {createHttpRuntime, type HttpTransport} from '@next/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpAccessToken,
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpSandboxId,
    selectTcpRuntimeState,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '../../src'
import {
    tcpBindingV2SliceDescriptor,
    tcpCredentialV2SliceDescriptor,
    tcpIdentityV2SliceDescriptor,
    tcpSandboxV2SliceDescriptor,
} from '../../src/features/slices'
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

const createMockTransport = (
    calls: string[],
    options?: {
        refreshFailure?: Error
        activationResponse?: {
            terminalId: string
            token: string
            refreshToken: string
            expiresIn: number
            refreshExpiresIn: number
        }
    },
): HttpTransport => ({
    async execute(request) {
        calls.push(`${request.endpoint.method} ${request.endpoint.pathTemplate}`)

        if (request.endpoint.pathTemplate === '/api/v1/terminals/activate') {
            expect(request.input.body).toMatchObject({
                sandboxId: 'sandbox-test-001',
            })
            return {
                data: {
                    success: true,
                    data: {
                        terminalId: options?.activationResponse?.terminalId ?? 'terminal-test-001',
                        token: options?.activationResponse?.token ?? 'access-token-001',
                        refreshToken: options?.activationResponse?.refreshToken ?? 'refresh-token-001',
                        expiresIn: options?.activationResponse?.expiresIn ?? 7200,
                        refreshExpiresIn: options?.activationResponse?.refreshExpiresIn ?? 30 * 24 * 3600,
                        binding: {
                            platformId: 'platform-test',
                            tenantId: 'tenant-test',
                            brandId: 'brand-test',
                            projectId: 'project-test',
                            storeId: 'store-test',
                            profileId: 'profile-test',
                            templateId: 'template-test',
                        },
                    },
                } as any,
                status: 201,
                statusText: 'Created',
                headers: {},
            }
        }

        if (request.endpoint.pathTemplate === '/api/v1/terminals/token/refresh') {
            if (options?.refreshFailure) {
                throw options.refreshFailure
            }
            expect(request.input.body).toEqual({
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

        if (request.endpoint.pathTemplate === '/api/v1/terminals/{terminalId}/tasks/{instanceId}/result') {
            expect(request.input.path).toEqual({
                terminalId: 'terminal-test-001',
                instanceId: 'instance-test-001',
            })
            expect(request.input.body).toMatchObject({
                sandboxId: 'sandbox-test-001',
            })
            return {
                data: {
                    success: true,
                    data: {
                        instanceId: 'instance-test-001',
                        status: 'COMPLETED',
                    },
                } as any,
                status: 200,
                statusText: 'OK',
                headers: {},
            }
        }

        if (request.endpoint.pathTemplate === '/api/v1/terminals/{terminalId}/deactivate') {
            expect(request.input.path).toEqual({
                terminalId: 'terminal-test-001',
            })
            expect(request.input.body).toMatchObject({
                sandboxId: 'sandbox-test-001',
            })
            return {
                data: {
                    success: true,
                    data: {
                        terminalId: 'terminal-test-001',
                        status: 'DEACTIVATED',
                        deactivatedAt: Date.now(),
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

const createRuntime = (input: {
    localNodeId?: string
    stateStorage: ReturnType<typeof createMemoryStorage>
    secureStateStorage: ReturnType<typeof createMemoryStorage>
    calls?: string[]
    transportOptions?: Parameters<typeof createMockTransport>[1]
}) => {
    const calls = input.calls ?? []

    return createKernelRuntimeV2({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.tcp-control-runtime-v2.test',
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
                                moduleName: 'kernel.base.tcp-control-runtime-v2.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createMockTransport(calls, input.transportOptions),
                            servers: resolveTransportServers(kernelBaseTestServerConfig),
                        })
                    },
                },
            }),
        ],
    })
}

describe('tcp-control-runtime-v2', () => {
    it('syncs activated tcp slices from primary state to managed secondary state', () => {
        const nextIdentity = applySliceSyncDiff(
            tcpIdentityV2SliceDescriptor,
            {
                activationStatus: 'UNACTIVATED',
                deviceFingerprint: 'DEVICE-001',
                deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
            },
            createSliceSyncDiff(
                tcpIdentityV2SliceDescriptor,
                {
                    activationStatus: 'ACTIVATED',
                    deviceFingerprint: 'DEVICE-001',
                    deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
                    terminalId: 'terminal-001',
                    activatedAt: 100,
                },
                createSliceSyncSummary(tcpIdentityV2SliceDescriptor, {
                    activationStatus: 'UNACTIVATED',
                    deviceFingerprint: 'DEVICE-001',
                    deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
                }),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextCredential = applySliceSyncDiff(
            tcpCredentialV2SliceDescriptor,
            {status: 'EMPTY'},
            createSliceSyncDiff(
                tcpCredentialV2SliceDescriptor,
                {
                    accessToken: 'token-001',
                    refreshToken: 'refresh-001',
                    expiresAt: 200,
                    refreshExpiresAt: 300,
                    status: 'READY',
                    updatedAt: 100,
                },
                createSliceSyncSummary(tcpCredentialV2SliceDescriptor, {status: 'EMPTY'}),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextBinding = applySliceSyncDiff(
            tcpBindingV2SliceDescriptor,
            {},
            createSliceSyncDiff(
                tcpBindingV2SliceDescriptor,
                {
                    platformId: 'platform-001',
                    tenantId: 'tenant-001',
                },
                createSliceSyncSummary(tcpBindingV2SliceDescriptor, {}),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextSandbox = applySliceSyncDiff(
            tcpSandboxV2SliceDescriptor,
            {},
            createSliceSyncDiff(
                tcpSandboxV2SliceDescriptor,
                {
                    sandboxId: 'sandbox-001',
                    updatedAt: 100,
                },
                createSliceSyncSummary(tcpSandboxV2SliceDescriptor, {}),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )

        expect(nextIdentity).toMatchObject({
            activationStatus: 'ACTIVATED',
            terminalId: 'terminal-001',
            activatedAt: 100,
        })
        expect(nextCredential).toMatchObject({
            status: 'READY',
            accessToken: 'token-001',
        })
        expect(nextBinding).toMatchObject({
            platformId: 'platform-001',
            tenantId: 'tenant-001',
        })
        expect(nextSandbox).toMatchObject({
            sandboxId: 'sandbox-001',
            updatedAt: 100,
        })
    })

    it('applies authoritative tcp diff clears without keeping stale values', () => {
        const nextIdentity = applySliceSyncDiff(
            tcpIdentityV2SliceDescriptor,
            {
                activationStatus: 'ACTIVATED',
                deviceFingerprint: 'DEVICE-001',
                deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
                terminalId: 'terminal-001',
                activatedAt: 100,
            },
            createSliceSyncDiff(
                tcpIdentityV2SliceDescriptor,
                {
                    activationStatus: 'UNACTIVATED',
                    deviceFingerprint: 'DEVICE-001',
                    deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
                },
                createSliceSyncSummary(tcpIdentityV2SliceDescriptor, {
                    activationStatus: 'ACTIVATED',
                    deviceFingerprint: 'DEVICE-001',
                    deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
                    terminalId: 'terminal-001',
                    activatedAt: 100,
                }),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextCredential = applySliceSyncDiff(
            tcpCredentialV2SliceDescriptor,
            {
                accessToken: 'token-001',
                refreshToken: 'refresh-001',
                expiresAt: 200,
                refreshExpiresAt: 300,
                status: 'READY',
                updatedAt: 100,
            },
            createSliceSyncDiff(
                tcpCredentialV2SliceDescriptor,
                {
                    status: 'EMPTY',
                },
                createSliceSyncSummary(tcpCredentialV2SliceDescriptor, {
                    accessToken: 'token-001',
                    refreshToken: 'refresh-001',
                    expiresAt: 200,
                    refreshExpiresAt: 300,
                    status: 'READY',
                    updatedAt: 100,
                }),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextBinding = applySliceSyncDiff(
            tcpBindingV2SliceDescriptor,
            {
                platformId: 'platform-001',
                tenantId: 'tenant-001',
            },
            createSliceSyncDiff(
                tcpBindingV2SliceDescriptor,
                {},
                createSliceSyncSummary(tcpBindingV2SliceDescriptor, {
                    platformId: 'platform-001',
                    tenantId: 'tenant-001',
                }),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )
        const nextSandbox = applySliceSyncDiff(
            tcpSandboxV2SliceDescriptor,
            {
                sandboxId: 'sandbox-001',
                updatedAt: 100,
            },
            createSliceSyncDiff(
                tcpSandboxV2SliceDescriptor,
                {},
                createSliceSyncSummary(tcpSandboxV2SliceDescriptor, {
                    sandboxId: 'sandbox-001',
                    updatedAt: 100,
                }),
                {mode: 'authoritative'},
            ),
            {mode: 'authoritative'},
        )

        expect(nextIdentity).toMatchObject({
            activationStatus: 'UNACTIVATED',
            deviceFingerprint: 'DEVICE-001',
            deviceInfo: {id: 'DEVICE-001', model: 'RN84'},
        })
        expect(nextIdentity.terminalId).toBeUndefined()
        expect(nextIdentity.activatedAt).toBeUndefined()
        expect(nextCredential).toMatchObject({
            status: 'EMPTY',
        })
        expect(nextCredential.accessToken).toBeUndefined()
        expect(nextCredential.refreshToken).toBeUndefined()
        expect(nextCredential.expiresAt).toBeUndefined()
        expect(nextBinding).toEqual({})
        expect(nextSandbox).toEqual({})
    })

    it('returns stable snapshot selector references for unchanged state', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_selector_stability',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()

        const initialState = runtime.getState()
        expect(selectTcpIdentitySnapshot(initialState)).toBe(selectTcpIdentitySnapshot(initialState))
        expect(selectTcpCredentialSnapshot(initialState)).toBe(selectTcpCredentialSnapshot(initialState))
        expect(selectTcpBindingSnapshot(initialState)).toBe(selectTcpBindingSnapshot(initialState))

        await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
                deviceInfo: {
                    id: 'device-test-selector-stability',
                    model: 'Mock POS',
                },
            }),
        )

        const nextState = runtime.getState()
        expect(selectTcpIdentitySnapshot(nextState)).toBe(selectTcpIdentitySnapshot(nextState))
        expect(selectTcpCredentialSnapshot(nextState)).toBe(selectTcpCredentialSnapshot(nextState))
        expect(selectTcpBindingSnapshot(nextState)).toBe(selectTcpBindingSnapshot(nextState))
        expect(selectTcpIdentitySnapshot(nextState)).not.toBe(selectTcpIdentitySnapshot(initialState))
    })

    it('activates terminal, refreshes credential, reports task result, and persists only recovery state', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const calls: string[] = []
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_test',
            stateStorage,
            secureStateStorage,
            calls,
        })

        await runtime.start()

        const bootstrapRequestId = createRequestId()
        const bootstrapResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
                deviceInfo: {
                    id: 'device-test-001',
                    model: 'Mock POS',
                },
            }),
            {requestId: bootstrapRequestId},
        )

        expect(bootstrapResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(bootstrapRequestId)?.status).toBe('COMPLETED')

        const activationRequestId = createRequestId()
        const activationResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
                sandboxId: 'sandbox-test-001',
                activationCode: 'ACT-KERNEL-BASE-001',
            }),
            {requestId: activationRequestId},
        )

        expect(activationResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(activationRequestId)?.commands.map(item => item.commandName)).toEqual([
            tcpControlV2CommandDefinitions.activateTerminal.commandName,
            tcpControlV2CommandDefinitions.activateTerminalSucceeded.commandName,
        ])
        expect(selectTcpTerminalId(runtime.getState())).toBe('terminal-test-001')
        expect(selectTcpSandboxId(runtime.getState())).toBe('sandbox-test-001')
        expect(selectTcpAccessToken(runtime.getState())).toBe('access-token-001')
        expect(selectTcpIdentitySnapshot(runtime.getState())).toMatchObject({
            deviceFingerprint: 'device-test-001',
            terminalId: 'terminal-test-001',
            activationStatus: 'ACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            accessToken: 'access-token-001',
            refreshToken: 'refresh-token-001',
            status: 'READY',
        })
        expect(selectTcpBindingSnapshot(runtime.getState())).toMatchObject({
            storeId: 'store-test',
            templateId: 'template-test',
        })
        expect(selectTcpRuntimeState(runtime.getState())?.lastActivationRequestId).toBe(activationRequestId)

        const refreshRequestId = createRequestId()
        const refreshResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
            {requestId: refreshRequestId},
        )

        expect(refreshResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(refreshRequestId)?.commands.map(item => item.commandName)).toEqual([
            tcpControlV2CommandDefinitions.refreshCredential.commandName,
            tcpControlV2CommandDefinitions.credentialRefreshed.commandName,
        ])
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            accessToken: 'access-token-002',
            refreshToken: 'refresh-token-001',
            status: 'READY',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState()).expiresAt).toBeGreaterThan(Date.now())

        const taskReportRequestId = createRequestId()
        const taskReportResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.reportTaskResult, {
                instanceId: 'instance-test-001',
                status: 'COMPLETED',
                result: {ok: true},
            }),
            {requestId: taskReportRequestId},
        )

        expect(taskReportResult.status).toBe('COMPLETED')
        expect(runtime.queryRequest(taskReportRequestId)?.commands.map(item => item.commandName)).toEqual([
            tcpControlV2CommandDefinitions.reportTaskResult.commandName,
            tcpControlV2CommandDefinitions.taskResultReported.commandName,
        ])
        expect(calls).toEqual([
            'POST /api/v1/terminals/activate',
            'POST /api/v1/terminals/token/refresh',
            'POST /api/v1/terminals/{terminalId}/tasks/{instanceId}/result',
        ])

        await runtime.flushPersistence()

        expect(
            stateStorage.saved.has('kernel-runtime-v2:node_tcp_v2_test:app-state:kernel.base.tcp-control-runtime-v2.runtime:bootstrapped'),
        ).toBe(false)
        expect([...secureStateStorage.saved.keys()].some(key => key.endsWith(':accessToken'))).toBe(true)
        expect([...secureStateStorage.saved.keys()].some(key => key.endsWith(':refreshToken'))).toBe(true)

        const restartedRuntime = createRuntime({
            localNodeId: 'node_tcp_v2_test',
            stateStorage,
            secureStateStorage,
        })

        await restartedRuntime.start()

        expect(selectTcpIdentitySnapshot(restartedRuntime.getState())).toMatchObject({
            terminalId: 'terminal-test-001',
            activationStatus: 'ACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(restartedRuntime.getState())).toMatchObject({
            accessToken: 'access-token-002',
            refreshToken: 'refresh-token-001',
            status: 'READY',
        })
        expect(selectTcpRuntimeState(restartedRuntime.getState())).toMatchObject({
            bootstrapped: false,
        })
        expect(selectTcpRuntimeState(restartedRuntime.getState())?.lastActivationRequestId).toBeUndefined()
        expect(selectTcpSandboxId(restartedRuntime.getState())).toBe('sandbox-test-001')
    })

    it('deactivates terminal remotely and clears local activation recovery state', async () => {
        const stateStorage = createMemoryStorage()
        const secureStateStorage = createMemoryStorage()
        const calls: string[] = []
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_deactivate',
            stateStorage,
            secureStateStorage,
            calls,
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-deactivate',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-DEACTIVATE-001',
        }))

        expect(selectTcpIdentitySnapshot(runtime.getState()).activationStatus).toBe('ACTIVATED')
        expect(selectTcpCredentialSnapshot(runtime.getState()).status).toBe('READY')

        const deactivateRequestId = createRequestId()
        const result = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.deactivateTerminal, {
                reason: 'admin-console-reset',
            }),
            {requestId: deactivateRequestId},
        )

        expect(result.status).toBe('COMPLETED')
        expect(runtime.queryRequest(deactivateRequestId)?.commands.map(item => item.commandName)).toEqual([
            tcpControlV2CommandDefinitions.deactivateTerminal.commandName,
            tcpControlV2CommandDefinitions.deactivateTerminalSucceeded.commandName,
            tcpControlV2CommandDefinitions.resetTcpControl.commandName,
        ])
        expect(calls).toEqual([
            'POST /api/v1/terminals/activate',
            'POST /api/v1/terminals/{terminalId}/deactivate',
        ])
        expect(selectTcpIdentitySnapshot(runtime.getState())).toMatchObject({
            activationStatus: 'UNACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            status: 'EMPTY',
        })
        expect(selectTcpBindingSnapshot(runtime.getState())).toEqual({})

        await runtime.flushPersistence()
        expect([...stateStorage.saved.keys()].some(key => key.endsWith(':terminalId'))).toBe(false)
        expect([...secureStateStorage.saved.keys()].some(key => key.endsWith(':accessToken'))).toBe(false)
        expect([...secureStateStorage.saved.keys()].some(key => key.endsWith(':refreshToken'))).toBe(false)
    })

    it('fails refreshCredential immediately when refreshToken is missing', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_missing_refresh_token',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()
        const result = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
            {requestId: createRequestId()},
        )

        expect(result.status).toBe('FAILED')
        expect(selectTcpCredentialSnapshot(runtime.getState()).status).toBe('EMPTY')
        expect(selectTcpRuntimeState(runtime.getState())?.lastError).toMatchObject({
            key: 'kernel.base.tcp-control-runtime-v2.credential_missing',
        })
    })

    it('resets credential status to EMPTY and stores lastError when refresh http call fails', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_refresh_failure',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
            transportOptions: {
                refreshFailure: new Error('refresh transport failed'),
            },
        })

        await runtime.start()
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.bootstrapTcpControl, {
            deviceInfo: {
                id: 'device-test-refresh-failure',
                model: 'Mock POS',
            },
        }))
        await runtime.dispatchCommand(createCommand(tcpControlV2CommandDefinitions.activateTerminal, {
            sandboxId: 'sandbox-test-001',
            activationCode: 'ACT-TCP-FAIL-001',
        }))

        const result = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
            {requestId: createRequestId()},
        )

        expect(result.status).toBe('FAILED')
        expect(selectTcpCredentialSnapshot(runtime.getState()).status).toBe('EMPTY')
        expect(selectTcpRuntimeState(runtime.getState())?.lastError).toMatchObject({
            key: 'kernel.base.tcp-control-runtime-v2.refresh_failed',
        })
    })

    it('fails task result reporting when terminalId is unavailable', async () => {
        const runtime = createRuntime({
            localNodeId: 'node_tcp_v2_missing_terminal',
            stateStorage: createMemoryStorage(),
            secureStateStorage: createMemoryStorage(),
        })

        await runtime.start()
        const result = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.reportTaskResult, {
                instanceId: 'instance-test-missing-terminal',
                status: 'FAILED',
                error: {message: 'broken'},
            }),
            {requestId: createRequestId()},
        )

        expect(result.status).toBe('FAILED')
        expect(selectTcpRuntimeState(runtime.getState())?.lastError).toMatchObject({
            key: 'kernel.base.tcp-control-runtime-v2.bootstrap_hydration_failed',
        })
    })
})
