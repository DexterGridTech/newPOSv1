import {describe, expect, it} from 'vitest'
import {createNodeId, createRequestId} from '@impos2/kernel-base-contracts'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createCommand, createKernelRuntimeV2} from '@impos2/kernel-base-runtime-shell-v2'
import {createHttpRuntime, type HttpTransport} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    selectTcpAccessToken,
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '../../src'

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

const createMockTransport = (calls: string[]): HttpTransport => ({
    async execute(request) {
        calls.push(`${request.endpoint.method} ${request.endpoint.pathTemplate}`)

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
            expect(request.input.body).toEqual({
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

        throw new Error(`Unexpected endpoint: ${request.endpoint.pathTemplate}`)
    },
})

const createRuntime = (input: {
    localNodeId?: string
    stateStorage: ReturnType<typeof createMemoryStorage>
    secureStateStorage: ReturnType<typeof createMemoryStorage>
    calls?: string[]
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
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tcp-control-runtime-v2.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createMockTransport(calls),
                            servers: [
                                {
                                    serverName: 'mock-terminal-platform',
                                    addresses: [
                                        {
                                            addressName: 'test',
                                            baseUrl: 'http://mock-terminal-platform.test',
                                        },
                                    ],
                                },
                            ],
                        })
                    },
                },
            }),
        ],
    })
}

describe('tcp-control-runtime-v2', () => {
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
    })
})
