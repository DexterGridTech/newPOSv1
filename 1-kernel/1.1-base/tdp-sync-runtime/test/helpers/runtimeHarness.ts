import {createNodeId} from '@impos2/kernel-base-contracts'
import type {ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {createKernelRuntime} from '@impos2/kernel-base-runtime-shell'
import {
    createHttpRuntime,
    createSocketRuntime,
    type HttpTransport,
    type SocketTransport,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModule,
} from '@impos2/kernel-base-tcp-control-runtime'
import {
    createTdpSyncRuntimeModule,
    tdpSyncSocketProfile,
    type CreateTdpSyncRuntimeModuleInput,
    type TdpClientMessage,
    type TdpProjectionEnvelope,
    type TdpServerMessage,
} from '../../src'

export const createMemoryStorage = () => {
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

const readStorageFile = (filePath: string): Record<string, string> => {
    if (!fs.existsSync(filePath)) {
        return {}
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) {
        return {}
    }
    return JSON.parse(raw) as Record<string, string>
}

const writeStorageFile = (filePath: string, content: Record<string, string>) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8')
}

export const createFileStorage = (filePath: string) => {
    return {
        filePath,
        storage: {
            async getItem(key: string) {
                return readStorageFile(filePath)[key] ?? null
            },
            async setItem(key: string, value: string) {
                const content = readStorageFile(filePath)
                content[key] = value
                writeStorageFile(filePath, content)
            },
            async removeItem(key: string) {
                const content = readStorageFile(filePath)
                delete content[key]
                writeStorageFile(filePath, content)
            },
            async multiGet(keys: readonly string[]) {
                const content = readStorageFile(filePath)
                return Object.fromEntries(keys.map(key => [key, content[key] ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                const content = readStorageFile(filePath)
                Object.entries(entries).forEach(([key, value]) => {
                    content[key] = value
                })
                writeStorageFile(filePath, content)
            },
            async multiRemove(keys: readonly string[]) {
                const content = readStorageFile(filePath)
                keys.forEach(key => {
                    delete content[key]
                })
                writeStorageFile(filePath, content)
            },
            async getAllKeys() {
                return Object.keys(readStorageFile(filePath))
            },
            async clear() {
                writeStorageFile(filePath, {})
            },
        },
        readSnapshot() {
            return readStorageFile(filePath)
        },
        reset() {
            writeStorageFile(filePath, {})
        },
    }
}

export const createFileStoragePair = (prefix = 'tdp-sync-runtime-live') => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
    const stateFilePath = path.join(dir, 'state-storage.json')
    const secureStateFilePath = path.join(dir, 'secure-state-storage.json')

    const stateStorage = createFileStorage(stateFilePath)
    const secureStateStorage = createFileStorage(secureStateFilePath)

    return {
        dir,
        stateStorage,
        secureStateStorage,
        reset() {
            stateStorage.reset()
            secureStateStorage.reset()
        },
        cleanup() {
            fs.rmSync(dir, {recursive: true, force: true})
        },
    }
}

export const projectionA: TdpProjectionEnvelope = {
    topic: 'config.delta',
    itemKey: 'cfg-1',
    operation: 'upsert',
    scopeType: 'TERMINAL',
    scopeId: 'terminal-test-001',
    revision: 1,
    payload: {
        value: 'A',
    },
    occurredAt: '2026-04-11T10:00:00.000Z',
    sourceReleaseId: null,
}

export const projectionB: TdpProjectionEnvelope = {
    topic: 'tcp.task.release',
    itemKey: 'task-1',
    operation: 'upsert',
    scopeType: 'TERMINAL',
    scopeId: 'terminal-test-001',
    revision: 2,
    payload: {
        instanceId: 'instance-001',
        title: 'Task A',
    },
    occurredAt: '2026-04-11T10:01:00.000Z',
    sourceReleaseId: 'release-1',
}

export const createMockTcpTransport = (): HttpTransport => ({
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
                            storeId: 'store-test',
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

        throw new Error(`Unexpected TCP endpoint: ${request.endpoint.pathTemplate}`)
    },
})

export const createMockTdpTransport = (input: {
    onClientMessage?(message: TdpClientMessage): void
    onHandshake?(emit: (message: TdpServerMessage) => void, message: Extract<TdpClientMessage, {type: 'HANDSHAKE'}>): void
    onDisconnect?(reason?: string): void
}) => {
    let handlersRef: Parameters<SocketTransport['connect']>[1] | undefined
    const sentMessages: TdpClientMessage[] = []
    let connectCount = 0

    const transport: SocketTransport = {
        async connect(_connection, handlers) {
            connectCount += 1
            handlersRef = handlers
            handlers.onOpen()

            return {
                sendRaw(payload: string) {
                    const message = JSON.parse(payload) as TdpClientMessage
                    sentMessages.push(message)
                    input.onClientMessage?.(message)
                    if (message.type === 'HANDSHAKE') {
                        queueMicrotask(() => {
                            input.onHandshake?.(serverMessage => {
                                handlers.onMessage(JSON.stringify(serverMessage))
                            }, message)
                        })
                    }
                },
                disconnect(reason?: string) {
                    handlers.onClose(reason)
                    input.onDisconnect?.(reason)
                },
            }
        },
    }

    return {
        transport,
        sentMessages,
        getConnectCount() {
            return connectCount
        },
        emitServerMessage(message: TdpServerMessage) {
            handlersRef?.onMessage(JSON.stringify(message))
        },
        emitSocketError(error: unknown) {
            handlersRef?.onError(error)
        },
        emitSocketClose(reason?: string) {
            handlersRef?.onClose(reason)
        },
    }
}

export const createRuntime = (input: {
    localNodeId?: string
    stateStorage: ReturnType<typeof createMemoryStorage>
    secureStateStorage: ReturnType<typeof createMemoryStorage>
    tdpTransport: ReturnType<typeof createMockTdpTransport>
    startupSeed?: {
        parameterCatalog?: Record<string, ParameterCatalogEntry>
    }
    tdpModuleInput?: CreateTdpSyncRuntimeModuleInput
}) => {
    const socketRuntime = createSocketRuntime({
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write() {},
            scope: {
                moduleName: 'kernel.base.tdp-sync-runtime.test.socket',
                layer: 'kernel',
            },
        }),
        transport: input.tdpTransport.transport,
        servers: [
            {
                serverName: 'mock-terminal-platform',
                addresses: [
                    {
                        addressName: 'local',
                        baseUrl: 'http://mock-terminal-platform.test',
                    },
                ],
            },
        ],
    })

    return createKernelRuntime({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        localRuntimeVersion: 'kernel-base-test-runtime',
        startupSeed: input.startupSeed,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.tdp-sync-runtime.test',
                    layer: 'kernel',
                },
            }),
            stateStorage: input.stateStorage.storage,
            secureStateStorage: input.secureStateStorage.storage,
        }),
        modules: [
            createTcpControlRuntimeModule({
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tcp-control-runtime.test',
                                subsystem: 'transport.http',
                            }),
                            transport: createMockTcpTransport(),
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
            createTdpSyncRuntimeModule({
                ...input.tdpModuleInput,
                assembly: {
                    createHttpRuntime(context) {
                        return createHttpRuntime({
                            logger: context.platformPorts.logger.scope({
                                moduleName: 'kernel.base.tdp-sync-runtime.test',
                                subsystem: 'transport.http',
                            }),
                            transport: {
                                async execute(request) {
                                    throw new Error(`Unexpected TDP HTTP endpoint: ${request.endpoint.pathTemplate}`)
                                },
                            },
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
                    resolveSocketBinding() {
                        return {
                            socketRuntime,
                            profileName: tdpSyncSocketProfile.name,
                            profile: tdpSyncSocketProfile,
                        }
                    },
                },
            }),
        ],
    })
}
