import {describe, expect, it} from 'vitest'
// @ts-ignore
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    callHttpEnvelope,
    callHttpResult,
    createHttpRuntime,
    createModuleHttpEndpointFactory,
    defineHttpEndpoint,
    defineHttpServiceModule,
    normalizeTransportError,
    transportRuntimeParameterDefinitions,
    typed,
    type HttpTransport,
} from '../../src'
import {compilePath} from '../../src/foundations/shared'

describe('transport-runtime http', () => {
    it('fails over to the second address when the first address fails', async () => {
        const calls: string[] = []

        const transport: HttpTransport = {
            // @ts-ignore
            async execute(request) {
                calls.push(request.selectedAddress.addressName)
                if (request.selectedAddress.addressName === 'primary') {
                    throw new Error('primary failed')
                }

                return {
                    data: {ok: true},
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                }
            },
        }

        const runtime = createHttpRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport,
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                        {addressName: 'secondary', baseUrl: 'http://secondary.local'},
                    ],
                },
            ],
            executionPolicy: {
                retryRounds: 0,
                failoverStrategy: 'ordered',
            },
        })

        const endpoint = defineHttpEndpoint<void, {q: string}, void, {ok: boolean}>({
            name: 'demo.http.echo',
            serverName: 'demo',
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

    it('supports declaration-style http service modules used by business packages', async () => {
        const transport: HttpTransport = {
            async execute(request) {
                return {
                    data: {
                        echoedName: request.input.body?.name,
                    },
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                }
            },
        }

        const runtime = createHttpRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport,
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                    ],
                },
            ],
        })

        const loginEndpoint = defineHttpEndpoint<void, void, {name: string}, {echoedName: string}>({
            name: 'demo.http.login',
            serverName: 'demo',
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

        const serviceModule = defineHttpServiceModule<DemoServices>('kernel.user.login', {
            auth: {
                async login(request) {
                    const response = await runtime.call(loginEndpoint, {
                        body: request,
                    })
                    return response.data
                },
            },
        })

        const result = await serviceModule.services.auth.login({name: 'boss'})

        expect(serviceModule.moduleName).toBe('kernel.user.login')
        expect(result).toEqual({
            echoedName: 'boss',
        })
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
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async execute(request) {
                    if (request.endpoint.name.endsWith('plain-login')) {
                        return {
                            data: {
                                echoedName: request.input.body?.name,
                            },
                            status: 200,
                            statusText: 'OK',
                            headers: {},
                        }
                    }

                    return {
                        data: {
                            success: true,
                            data: {
                                echoedName: request.input.body?.name,
                            },
                        },
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                    }
                },
            },
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                    ],
                },
            ],
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
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async execute() {
                    return {
                        data: {
                            success: false,
                            data: {ok: true},
                            error: {
                                message: 'server rejected',
                                details: {code: 'SERVER_REJECTED'},
                            },
                        },
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                    }
                },
            },
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                    ],
                },
            ],
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
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async execute() {
                    throw new TypeError('fetch failed')
                },
            },
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                    ],
                },
            ],
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
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport,
            servers: [
                {
                    serverName: 'demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://primary.local'},
                    ],
                },
            ],
        })

        const endpoint = defineHttpEndpoint<void, void, {name: string}, {ok: boolean}>({
            name: 'demo.http.login',
            serverName: 'demo',
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
})
