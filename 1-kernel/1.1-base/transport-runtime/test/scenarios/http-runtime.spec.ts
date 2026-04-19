import {describe, expect, it, vi} from 'vitest'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    kernelBaseTestServerConfig,
    SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_REPLACEMENT_TEST,
    SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_RETRY_TEST,
    SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST,
    SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
} from '@impos2/kernel-server-config-v2'
import {
    callHttpEnvelope,
    callHttpResult,
    createHttpRuntime,
    createHttpServiceBinder,
    createModuleHttpEndpointFactory,
    defineHttpEndpoint,
    normalizeTransportError,
    resolveHttpUrlCandidates,
    transportRuntimeParameterDefinitions,
    typed,
    type HttpTransport,
    type HttpSuccessResponse,
    type HttpTransportRequest,
} from '../../src'
import {compilePath} from '../../src/foundations/shared'
import {resolveTransportServers} from '../../../../test-support/serverConfig'

const createTestLogger = () => createLoggerPort({
    environmentMode: 'DEV',
    write: () => {},
    scope: {
        moduleName: 'kernel.base.transport-runtime.test',
        layer: 'kernel',
    },
})

const toSuccessResponse = <TResponse>(data: TResponse): HttpSuccessResponse<TResponse> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
})

const readBodyName = (
    request: HttpTransportRequest<any, any, any>,
) => (request.input.body as {name?: string} | undefined)?.name

describe('transport-runtime http', () => {
    it('fails over to the second address when the first address fails', async () => {
        const calls: string[] = []

        const transport: HttpTransport = {
            async execute(request) {
                calls.push(request.selectedAddress.addressName)
                if (request.selectedAddress.addressName === 'primary') {
                    throw new Error('primary failed')
                }

                return toSuccessResponse({ok: true} as any)
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig),
            executionPolicy: {
                retryRounds: 0,
                failoverStrategy: 'ordered',
            },
        })

        const endpoint = defineHttpEndpoint<void, {q: string}, void, {ok: boolean}>({
            name: 'demo.http.echo',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/echo',
            request: {
                query: typed<{q: string}>('demo.http.echo.query'),
            },
            response: typed<{ok: boolean}>('demo.http.echo.response'),
        })

        const response = await runtime.call(endpoint, {
            query: {q: '1'},
        })

        expect(response.data.ok).toBe(true)
        expect(calls).toEqual(['primary', 'secondary'])
    })

    it('retries rounds across addresses and remembers the last successful address', async () => {
        const calls: string[] = []
        const addressAttempts = new Map<string, number>()

        const transport: HttpTransport = {
            async execute(request) {
                const currentAttempts = (addressAttempts.get(request.selectedAddress.addressName) ?? 0) + 1
                addressAttempts.set(request.selectedAddress.addressName, currentAttempts)
                calls.push(request.selectedAddress.addressName)

                if (request.selectedAddress.addressName === 'primary') {
                    throw new Error('primary failed')
                }

                if (request.selectedAddress.addressName === 'secondary' && currentAttempts === 1) {
                    throw new Error('secondary transient failed')
                }

                return toSuccessResponse({ok: true} as any)
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                selectedSpace: SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_RETRY_TEST,
            }),
            executionPolicy: {
                retryRounds: 1,
                failoverStrategy: 'ordered',
            },
        })

        const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.retry-and-stick',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/retry-and-stick',
            request: {},
            response: typed<{ok: boolean}>('demo.http.retry-and-stick.response'),
        })

        const firstResponse = await runtime.call(endpoint)
        const secondResponse = await runtime.call(endpoint)

        expect(firstResponse.data.ok).toBe(true)
        expect(secondResponse.data.ok).toBe(true)
        expect(calls).toEqual([
            'primary',
            'secondary',
            'tertiary',
            'tertiary',
        ])
    })

    it('clears the remembered effective address after replaceServers and uses the new order', async () => {
        const calls: string[] = []

        const transport: HttpTransport = {
            async execute(request) {
                calls.push(request.selectedAddress.addressName)
                if (request.selectedAddress.addressName === 'primary') {
                    throw new Error('primary failed')
                }
                return toSuccessResponse({ok: true} as any)
            },
        }

        const initialServers = resolveTransportServers(kernelBaseTestServerConfig)

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: initialServers,
            executionPolicy: {
                retryRounds: 0,
                failoverStrategy: 'ordered',
            },
        })

        const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.replace-servers',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/replace-servers',
            request: {},
            response: typed<{ok: boolean}>('demo.http.replace-servers.response'),
        })

        await runtime.call(endpoint)

        runtime.replaceServers(resolveTransportServers(kernelBaseTestServerConfig, {
            selectedSpace: SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_REPLACEMENT_TEST,
        }))

        await runtime.call(endpoint)

        expect(calls).toEqual([
            'primary',
            'secondary',
            'new-primary',
        ])
    })

    it('keeps the previous server catalog when replaceServers validation fails', async () => {
        const transport: HttpTransport = {
            async execute() {
                return toSuccessResponse({ok: true} as any)
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig),
        })

        expect(() => runtime.replaceServers([
            {
                serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
                addresses: [],
            },
        ])).toThrowError(/Server has no addresses/)

        const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.replace-servers-rollback',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/replace-servers-rollback',
            request: {},
            response: typed<{ok: boolean}>('demo.http.replace-servers-rollback.response'),
        })

        const response = await runtime.call(endpoint)
        expect(response.data.ok).toBe(true)
    })

    it('supports service-first http helpers used by business packages', async () => {
        const transport: HttpTransport = {
            async execute(request) {
                return toSuccessResponse({
                    echoedName: readBodyName(request),
                } as any)
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        const loginEndpoint = defineHttpEndpoint<void, void, {name: string}, {echoedName: string}>({
            name: 'demo.http.login',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST,
            method: 'POST',
            pathTemplate: '/login',
            request: {
                body: typed<{name: string}>('demo.http.login.body'),
            },
            response: typed<{echoedName: string}>('demo.http.login.response'),
        })

        interface DemoServices {
            auth: {
                login(request: {name: string}): Promise<{echoedName: string}>
            }
        }

        const services: DemoServices = {
            auth: {
                async login(request) {
                    const response = await runtime.call(loginEndpoint, {
                        body: request,
                    })
                    return response.data
                },
            },
        }

        const result = await services.auth.login({name: 'boss'})

        expect(result).toEqual({
            echoedName: 'boss',
        })
    })

    it('enforces maxConcurrent queueing and never exceeds the configured parallelism', async () => {
        let activeCount = 0
        let maxObservedActiveCount = 0
        const startedAddresses: string[] = []

        const transport: HttpTransport = {
            async execute(request) {
                startedAddresses.push(request.selectedAddress.addressName)
                activeCount += 1
                maxObservedActiveCount = Math.max(maxObservedActiveCount, activeCount)
                await new Promise(resolve => setTimeout(resolve, 10))
                activeCount -= 1
                return toSuccessResponse({ok: true} as any)
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig),
            executionPolicy: {
                maxConcurrent: 2,
            },
        })
        const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.max-concurrent',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/max-concurrent',
            request: {},
            response: typed<{ok: boolean}>('demo.http.max-concurrent.response'),
        })

        const requests = [
            runtime.call(endpoint),
            runtime.call(endpoint),
            runtime.call(endpoint),
        ]

        await Promise.all(requests)

        expect(maxObservedActiveCount).toBe(2)
        expect(startedAddresses).toEqual(['primary', 'primary', 'primary'])
    })

    it('enforces rate limits inside the configured time window', async () => {
        vi.useFakeTimers()
        try {
            const transport: HttpTransport = {
                async execute() {
                    return toSuccessResponse({ok: true} as any)
                },
            }

            const runtime = createHttpRuntime({
                logger: createTestLogger(),
                transport,
                servers: resolveTransportServers(kernelBaseTestServerConfig),
                executionPolicy: {
                    rateLimitWindowMs: 100,
                    rateLimitMaxRequests: 2,
                },
            })
            const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
                name: 'demo.http.rate-limit',
                serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
                method: 'GET',
                pathTemplate: '/rate-limit',
                request: {},
                response: typed<{ok: boolean}>('demo.http.rate-limit.response'),
            })

            await runtime.call(endpoint)
            await runtime.call(endpoint)
            await expect(runtime.call(endpoint)).rejects.toMatchObject({
                key: 'kernel.base.transport-runtime.network_error',
                details: {
                    windowMs: 100,
                    maxRequests: 2,
                },
            })

            await vi.advanceTimersByTimeAsync(100)
            await expect(runtime.call(endpoint)).resolves.toMatchObject({
                data: {ok: true},
            })
        } finally {
            vi.useRealTimers()
        }
    })

    it('stops retrying when shouldRetry returns false and records metrics for both success and failure', async () => {
        const calls: string[] = []
        const recorded: Array<{success: boolean; attempts: number}> = []

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute(request) {
                    calls.push(request.selectedAddress.addressName)
                    if (request.endpoint.pathTemplate === '/no-retry') {
                        throw new Error('hard stop')
                    }
                    if (request.endpoint.pathTemplate === '/single-address' && request.selectedAddress.addressName === 'primary') {
                        throw new Error('single address failed')
                    }
                    return toSuccessResponse({ok: true} as any)
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig),
            executionPolicy: {
                retryRounds: 2,
                failoverStrategy: 'ordered',
                shouldRetry(error, request) {
                    return request.endpoint.pathTemplate !== '/no-retry' && !(error instanceof Error && error.message === 'hard stop')
                },
            },
            metricsRecorder: {
                recordCall(metric) {
                    recorded.push({
                        success: metric.success,
                        attempts: metric.attempts.length,
                    })
                },
            },
        })
        const noRetryEndpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.no-retry',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/no-retry',
            request: {},
            response: typed<{ok: boolean}>('demo.http.no-retry.response'),
        })

        await expect(runtime.call(noRetryEndpoint)).rejects.toMatchObject({
            key: 'kernel.base.transport-runtime.http_runtime_failed',
            details: {
                endpointName: 'demo.http.no-retry',
                attempts: [
                    expect.objectContaining({
                        addressName: 'primary',
                    }),
                ],
            },
        })

        expect(calls).toEqual(['primary'])
        expect(recorded[0]).toEqual({
            success: false,
            attempts: 1,
        })
    })

    it('supports single-address failover strategy and refreshes servers from serverProvider per call', async () => {
        const calls: string[] = []
        let serverProviderCalls = 0

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute(request) {
                    calls.push(request.selectedAddress.addressName)
                    if (request.selectedAddress.addressName === 'new-primary') {
                        throw new Error('primary failed')
                    }
                    return toSuccessResponse({ok: true} as any)
                },
            },
            serverProvider() {
                serverProviderCalls += 1
                return resolveTransportServers(kernelBaseTestServerConfig, {
                    selectedSpace: SERVER_CONFIG_SPACE_KERNEL_BASE_HTTP_REPLACEMENT_TEST,
                })
            },
            executionPolicy: {
                retryRounds: 1,
                failoverStrategy: 'single-address',
            },
        })
        const endpoint = defineHttpEndpoint<void, void, void, {ok: boolean}>({
            name: 'demo.http.single-address',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            method: 'GET',
            pathTemplate: '/single-address',
            request: {},
            response: typed<{ok: boolean}>('demo.http.single-address.response'),
        })

        await expect(runtime.call(endpoint)).rejects.toMatchObject({
            key: 'kernel.base.transport-runtime.http_runtime_failed',
            details: {
                attempts: [
                    expect.objectContaining({addressName: 'new-primary'}),
                    expect.objectContaining({addressName: 'new-primary'}),
                ],
            },
        })
        await expect(runtime.call(endpoint)).rejects.toMatchObject({
            key: 'kernel.base.transport-runtime.http_runtime_failed',
        })

        expect(calls).toEqual([
            'new-primary',
            'new-primary',
            'new-primary',
            'new-primary',
        ])
        expect(serverProviderCalls).toBe(3)
    })

    it('creates module-scoped endpoint definitions with stable descriptor names', () => {
        const defineEndpoint = createModuleHttpEndpointFactory('kernel.base.demo-runtime', 'demo')

        const endpoint = defineEndpoint<
            {terminalId: string},
            {cursor?: number},
            {name: string},
            {ok: boolean}
        >('sync-demo', {
            method: 'POST',
            pathTemplate: '/api/v1/demo/{terminalId}',
            request: {
                path: true,
                query: true,
                body: true,
            },
        })

        expect(endpoint.name).toBe('kernel.base.demo-runtime.sync-demo')
        expect(endpoint.serverName).toBe('demo')
        expect(endpoint.request.path?.name).toBe('kernel.base.demo-runtime.sync-demo.path')
        expect(endpoint.request.query?.name).toBe('kernel.base.demo-runtime.sync-demo.query')
        expect(endpoint.request.body?.name).toBe('kernel.base.demo-runtime.sync-demo.body')
        expect(endpoint.response.name).toBe('kernel.base.demo-runtime.sync-demo.response')
    })

    it('supports helper-based result and envelope calls with consistent error mapping', async () => {
        const defineEndpoint = createModuleHttpEndpointFactory('kernel.base.demo-runtime', 'demo')
        const plainEndpoint = defineEndpoint<void, void, {name: string}, {echoedName: string}>('plain-login', {
            method: 'POST',
            pathTemplate: '/plain-login',
            request: {
                body: true,
            },
        })
        const envelopeEndpoint = defineEndpoint<void, void, {name: string}, {
            success: boolean
            data: {echoedName: string}
            error?: {message?: string; details?: unknown}
        }>('wrapped-login', {
            method: 'POST',
            pathTemplate: '/wrapped-login',
            request: {
                body: true,
            },
        })

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute(request) {
                    if (request.endpoint.name.endsWith('plain-login')) {
                        return toSuccessResponse({
                            echoedName: readBodyName(request),
                        } as any)
                    }

                    return toSuccessResponse({
                        success: true,
                        data: {
                            echoedName: readBodyName(request),
                        },
                    } as any)
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        const plainResult = await callHttpResult(
            runtime,
            plainEndpoint,
            {body: {name: 'alice'}},
            {
                errorDefinition: {
                    key: 'kernel.base.demo-runtime.call_failed',
                    name: 'Demo Call Failed',
                    defaultTemplate: 'Demo call failed: ${error}',
                    category: 'NETWORK',
                    severity: 'HIGH',
                    moduleName: 'kernel.base.demo-runtime',
                },
                fallbackMessage: 'plain login failed',
            },
        )

        const envelopeResult = await callHttpEnvelope(
            runtime,
            envelopeEndpoint,
            {body: {name: 'bob'}},
            {
                errorDefinition: {
                    key: 'kernel.base.demo-runtime.call_failed',
                    name: 'Demo Call Failed',
                    defaultTemplate: 'Demo call failed: ${error}',
                    category: 'NETWORK',
                    severity: 'HIGH',
                    moduleName: 'kernel.base.demo-runtime',
                },
                fallbackMessage: 'wrapped login failed',
            },
        )

        expect(plainResult).toEqual({echoedName: 'alice'})
        expect(envelopeResult).toEqual({echoedName: 'bob'})
    })

    it('provides a thin binder for service-first http methods without hiding endpoint semantics', async () => {
        const defineEndpoint = createModuleHttpEndpointFactory('kernel.base.demo-runtime', 'demo')
        const endpoint = defineEndpoint<void, void, {name: string}, {
            success: boolean
            data: {echoedName: string}
        }>('binder-login', {
            method: 'POST',
            pathTemplate: '/binder-login',
            request: {
                body: true,
            },
        })

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute(request) {
                    return toSuccessResponse({
                        success: true,
                        data: {
                            echoedName: readBodyName(request),
                        },
                    } as any)
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        const http = createHttpServiceBinder(runtime)
        const result = await http.envelope(endpoint, {
            body: {name: 'binder-user'},
        }, {
            errorDefinition: {
                key: 'kernel.base.demo-runtime.call_failed',
                name: 'Demo Call Failed',
                defaultTemplate: 'Demo call failed: ${error}',
                category: 'NETWORK',
                severity: 'HIGH',
                moduleName: 'kernel.base.demo-runtime',
            },
            fallbackMessage: 'binder login failed',
        })

        expect(result).toEqual({
            echoedName: 'binder-user',
        })
    })

    it('maps envelope and transport failures through the provided business error definition', async () => {
        const defineEndpoint = createModuleHttpEndpointFactory('kernel.base.demo-runtime', 'demo')
        const endpoint = defineEndpoint<void, void, void, {
            success: boolean
            data: {ok: true}
            error?: {message?: string; details?: unknown}
        }>('wrapped-login', {
            method: 'POST',
            pathTemplate: '/wrapped-login',
        })

        const errorDefinition = {
            key: 'kernel.base.demo-runtime.call_failed',
            name: 'Demo Call Failed',
            defaultTemplate: 'Demo call failed: ${error}',
            category: 'NETWORK',
            severity: 'HIGH',
            moduleName: 'kernel.base.demo-runtime',
        } as const

        const envelopeRuntime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute() {
                    return toSuccessResponse({
                        success: false,
                        data: {ok: true},
                        error: {
                            message: 'server rejected',
                            details: {code: 'SERVER_REJECTED'},
                        },
                    } as any)
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        await expect(callHttpEnvelope(
            envelopeRuntime,
            endpoint,
            undefined,
            {
                errorDefinition,
                fallbackMessage: 'wrapped login failed',
            },
        )).rejects.toMatchObject({
            key: errorDefinition.key,
            message: 'Demo call failed: server rejected',
            details: {code: 'SERVER_REJECTED'},
        })

        const networkRuntime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute() {
                    throw new TypeError('fetch failed')
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        await expect(callHttpEnvelope(
            networkRuntime,
            endpoint,
            undefined,
            {
                errorDefinition,
                fallbackMessage: 'wrapped login failed',
            },
        )).rejects.toMatchObject({
            key: errorDefinition.key,
            message: 'Demo call failed: HTTP runtime failed for kernel.base.demo-runtime.wrapped-login',
            details: {
                key: 'kernel.base.transport-runtime.http_runtime_failed',
            },
        })
    })

    it('throws structured configuration error when required path param is missing', () => {
        try {
            compilePath('/shops/{shopId}/orders/{orderId}', {
                shopId: 'S1',
            })
            throw new Error('expected compilePath to throw structured configuration error')
        } catch (error) {
            expect(error).toMatchObject({
                key: 'kernel.base.transport-runtime.configuration_error',
                category: 'SYSTEM',
            })
        }
    })

    it('exposes stable transport parameter defaults and normalizes unknown transport errors', () => {
        expect(transportRuntimeParameterDefinitions.httpRetryRounds.defaultValue).toBe(0)
        expect(transportRuntimeParameterDefinitions.httpRetryRounds.validate?.(0)).toBe(true)
        expect(transportRuntimeParameterDefinitions.httpRetryRounds.validate?.(-1)).toBe(false)

        expect(transportRuntimeParameterDefinitions.httpFailoverStrategy.defaultValue).toBe('ordered')
        expect(transportRuntimeParameterDefinitions.httpFailoverStrategy.validate?.('ordered')).toBe(true)
        expect(transportRuntimeParameterDefinitions.httpFailoverStrategy.validate?.('random')).toBe(false)

        const syntaxError = normalizeTransportError(new SyntaxError('bad json'))
        expect(syntaxError).toMatchObject({
            key: 'kernel.base.transport-runtime.parse_error',
            category: 'VALIDATION',
            message: 'bad json',
        })

        const unknownError = normalizeTransportError('boom')
        expect(unknownError).toMatchObject({
            key: 'kernel.base.transport-runtime.network_error',
            category: 'NETWORK',
            message: 'unknown transport error',
        })
    })

    it('supports old actor-style catch-and-rethrow normalization around http services', async () => {
        const transport: HttpTransport = {
            async execute() {
                throw new TypeError('fetch failed')
            },
        }

        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport,
            servers: resolveTransportServers(kernelBaseTestServerConfig, {
                serverOverrides: {
                    [SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST]: {
                        addresses: [
                            {
                                addressName: 'primary',
                                baseUrl: 'http://primary.local',
                            },
                        ],
                    },
                },
            }),
        })

        const endpoint = defineHttpEndpoint<void, void, {name: string}, {ok: boolean}>({
            name: 'demo.http.login',
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_DEMO_TEST,
            method: 'POST',
            pathTemplate: '/login',
            request: {
                body: typed<{name: string}>('demo.http.login.body'),
            },
            response: typed<{ok: boolean}>('demo.http.login.response'),
        })

        const callLogin = async () => {
            try {
                await runtime.call(endpoint, {
                    body: {name: 'boss'},
                })
                throw new Error('expected request to fail')
            } catch (error) {
                throw normalizeTransportError(error)
            }
        }

        await expect(callLogin()).rejects.toMatchObject({
            key: 'kernel.base.transport-runtime.http_runtime_failed',
            category: 'NETWORK',
            message: 'HTTP runtime failed for demo.http.login',
        })
    })

    it('resolves ordered absolute candidate urls for relative paths', () => {
        const runtime = createHttpRuntime({
            logger: createTestLogger(),
            transport: {
                async execute() {
                    return toSuccessResponse({ok: true} as any)
                },
            },
            servers: resolveTransportServers(kernelBaseTestServerConfig),
        })

        expect(resolveHttpUrlCandidates({
            runtime,
            serverName: SERVER_NAME_KERNEL_BASE_HTTP_FAILOVER_TEST,
            pathOrUrl: '/packages/update.zip',
        })).toEqual([
            'http://primary.local/packages/update.zip',
            'http://secondary.local/packages/update.zip',
        ])
    })

    it('returns absolute urls as-is without reading catalog', () => {
        expect(resolveHttpUrlCandidates({
            catalog: {
                resolveAddresses() {
                    throw new Error('catalog should not be used')
                },
            },
            serverName: 'ignored',
            pathOrUrl: 'https://cdn.example.com/update.zip',
        })).toEqual(['https://cdn.example.com/update.zip'])
    })
})
