import {createNodeId, createRequestId} from '@impos2/kernel-base-contracts'
import type {ParameterCatalogEntry} from '@impos2/kernel-base-contracts'
import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import {createLoggerPort, createPlatformPorts} from '@impos2/kernel-base-platform-ports'
import {existsSync} from 'node:fs'
import {spawn, spawnSync, type ChildProcessWithoutNullStreams} from 'node:child_process'
import {resolve} from 'node:path'
import {
    createKernelRuntimeV2,
    type RuntimeModuleContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    kernelBaseTestServerConfig,
    SERVER_NAME_MOCK_TERMINAL_PLATFORM,
} from '@impos2/kernel-server-config-v2'
import {
    createHttpRuntime,
    type HttpTransport,
} from '@impos2/kernel-base-transport-runtime'
import {
    createTcpControlRuntimeModuleV2,
    tcpControlV2CommandDefinitions,
} from '../../src'
import {createFileStoragePair, createMemoryStorage} from '../../../../test-support/storageHarness'
import {resolveTransportServers} from '../../../../test-support/serverConfig'

type StorageHarness = {
    storage: StateStoragePort
}

type ApiEnvelope<T> =
    | {success: true; data: T}
    | {success: false; error: {message: string; details?: unknown}}

export const waitFor = async (predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000) => {
    const startedAt = Date.now()
    while (!(await predicate())) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

export const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers ?? {}),
        },
    })
    const payload = await response.json() as ApiEnvelope<T>
    if (!response.ok || !payload.success) {
        const message = payload.success ? response.statusText : payload.error.message
        throw new Error(`HTTP ${response.status} ${message}`)
    }
    return payload.data
}

export const createFetchTransport = (): HttpTransport => ({
    async execute(request) {
        const response = await fetch(request.url, {
            method: request.endpoint.method,
            headers: {
                'content-type': 'application/json',
                ...(request.input.headers ?? {}),
            },
            body: request.input.body == null ? undefined : JSON.stringify(request.input.body),
        })
        return {
            data: await response.json(),
            status: response.status,
            statusText: response.statusText,
            headers: {},
        }
    },
})

const repoRoot = resolve(__dirname, '../../../../..')

const detachTimerIfSupported = (timer: ReturnType<typeof setTimeout>) => {
    const maybeTimer = timer as unknown as {unref?: () => void}
    if (typeof maybeTimer.unref === 'function') {
        maybeTimer.unref()
    }
}
const testServerSourceEntrypoint = resolve(
    repoRoot,
    '0-mock-server/mock-terminal-platform/server/src/test/startMockTerminalPlatformTestServer.ts',
)
const testServerCompiledEntrypoint = resolve(
    repoRoot,
    '0-mock-server/mock-terminal-platform/server/dist/test/startMockTerminalPlatformTestServer.js',
)
const testServerTsconfig = resolve(
    repoRoot,
    '0-mock-server/mock-terminal-platform/server/tsconfig.json',
)
const tscBin = resolve(repoRoot, 'node_modules/typescript/bin/tsc')
const readyPrefix = '[mock-terminal-platform:test-ready]'
let platformTestServerCompiled = false

const ensureCompiledPlatformTestServer = () => {
    if (platformTestServerCompiled && existsSync(testServerCompiledEntrypoint)) {
        return
    }
    const result = spawnSync(process.execPath, [tscBin, '-p', testServerTsconfig, '--pretty', 'false'], {
        cwd: repoRoot,
        encoding: 'utf8',
    })
    if (result.status !== 0 || !existsSync(testServerCompiledEntrypoint)) {
        throw new Error([
            `Failed to compile mock-terminal-platform test server from ${testServerSourceEntrypoint}`,
            `exit=${result.status}`,
            `stdout=${result.stdout}`,
            `stderr=${result.stderr}`,
        ].join('\n'))
    }
    platformTestServerCompiled = true
}

const waitForPlatformReady = async (
    child: ChildProcessWithoutNullStreams,
): Promise<{baseUrl: string}> => {
    let stdout = ''
    let stderr = ''
    return new Promise((resolveReady, rejectReady) => {
        const timeout = setTimeout(() => {
            rejectReady(new Error(`mock-terminal-platform test server did not become ready\nstdout=${stdout}\nstderr=${stderr}`))
        }, 10_000)

        const cleanup = () => {
            clearTimeout(timeout)
            child.stdout.off('data', onStdout)
            child.stderr.off('data', onStderr)
            child.off('exit', onExit)
            child.off('error', onError)
        }

        const onStdout = (chunk: Buffer) => {
            stdout += chunk.toString()
            const readyLine = stdout.split(/\r?\n/).find(line => line.startsWith(readyPrefix))
            if (!readyLine) {
                return
            }
            cleanup()
            resolveReady(JSON.parse(readyLine.slice(readyPrefix.length)) as {baseUrl: string})
        }

        const onStderr = (chunk: Buffer) => {
            stderr += chunk.toString()
        }

        const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
            cleanup()
            const rebuildHint = signal === 'SIGKILL'
                ? '\nHint: if this happens immediately after a Node upgrade, run `npm rebuild better-sqlite3` from the repo root.'
                : ''
            rejectReady(new Error(`mock-terminal-platform test server exited before ready code=${code} signal=${signal}\nstdout=${stdout}\nstderr=${stderr}${rebuildHint}`))
        }

        const onError = (error: Error) => {
            cleanup()
            rejectReady(error)
        }

        child.stdout.on('data', onStdout)
        child.stderr.on('data', onStderr)
        child.once('exit', onExit)
        child.once('error', onError)
    })
}

export const createLivePlatform = async () => {
    ensureCompiledPlatformTestServer()
    const server = spawn(process.execPath, [testServerCompiledEntrypoint], {
        cwd: repoRoot,
        env: process.env,
    })
    const {baseUrl} = await waitForPlatformReady(server)
    const prepare = await fetchJson<{
        sandboxId: string
        preparedAt: number
    }>(`${baseUrl}/mock-debug/kernel-base-test/prepare`, {
        method: 'POST',
    })

    return {
        baseUrl,
        prepare,
        async close() {
            if (server.exitCode != null || server.signalCode != null) {
                return
            }
            await new Promise<void>(resolveClose => {
                server.once('exit', () => resolveClose())
                server.kill('SIGTERM')
                const forceKillTimer = setTimeout(() => {
                    if (server.exitCode == null && server.signalCode == null) {
                        server.kill('SIGKILL')
                    }
                }, 2_000)
                detachTimerIfSupported(forceKillTimer)
            })
        },
        admin: {
            activationCodes: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/activation-codes?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            terminals: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/terminals?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            taskReleases: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/releases?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            taskInstances: () => fetchJson<any[]>(`${baseUrl}/api/v1/admin/tasks/instances?sandboxId=${encodeURIComponent(prepare.sandboxId)}`),
            createTaskRelease: (body: Record<string, unknown>) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/releases`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        ...body,
                        sandboxId: prepare.sandboxId,
                    }),
                },
            ),
            getTaskTrace: (instanceId: string) => fetchJson<any>(
                `${baseUrl}/api/v1/admin/tasks/instances/${instanceId}/trace?sandboxId=${encodeURIComponent(prepare.sandboxId)}`,
            ),
        },
    }
}

export const createLiveRuntime = (input: {
    baseUrl: string
    localNodeId?: string
    stateStorage?: StorageHarness
    secureStateStorage?: StorageHarness
    startupSeed?: {
        parameterCatalog?: Record<string, ParameterCatalogEntry>
    }
}) => {
    const stateStorage = input.stateStorage ?? createMemoryStorage()
    const secureStateStorage = input.secureStateStorage ?? createMemoryStorage()

    const runtime = createKernelRuntimeV2({
        localNodeId: (input.localNodeId ?? createNodeId()) as any,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write() {},
                scope: {
                    moduleName: 'kernel.base.tcp-control-runtime-v2.live-test',
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
                                moduleName: 'kernel.base.tcp-control-runtime-v2.live-test',
                                subsystem: 'transport.http',
                            }),
                            transport: createFetchTransport(),
                            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                                baseUrlOverrides: {
                                    [SERVER_NAME_MOCK_TERMINAL_PLATFORM]: input.baseUrl,
                                },
                            }),
                        })
                    },
                },
            }),
        ],
    })

    return {
        runtime,
        stateStorage,
        secureStateStorage,
    }
}

export const createLiveFileStoragePair = (prefix?: string) => {
    return createFileStoragePair(prefix ?? 'tcp-control-runtime-v2-live')
}

export const activateLiveTerminal = async (
    runtime: ReturnType<typeof createLiveRuntime>['runtime'],
    sandboxId: string,
    activationCode: string,
    deviceId: string,
) => {
    await runtime.dispatchCommand(
        {
            definition: tcpControlV2CommandDefinitions.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: deviceId,
                    model: 'Live Mock POS',
                },
            },
        },
        {requestId: createRequestId()},
    )
    await runtime.dispatchCommand(
        {
            definition: tcpControlV2CommandDefinitions.activateTerminal,
            payload: {
                sandboxId,
                activationCode,
            },
        },
        {requestId: createRequestId()},
    )
}
