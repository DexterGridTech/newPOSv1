import {describe, expect, it, vi} from 'vitest'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    buildSocketUrl,
    createSocketRuntime,
    defineSocketProfile,
    JsonSocketCodec,
    transportRuntimeParameterDefinitions,
    typed,
    type SocketTransport,
} from '../../src'

describe('transport-runtime socket', () => {
    it('registers profile, connects, emits message, and disconnects', async () => {
        const events: string[] = []
        let handlersRef: Parameters<SocketTransport['connect']>[1] | undefined

        const transport: SocketTransport = {
            async connect(connection, handlers) {
                handlersRef = handlers
                handlers.onOpen()
                handlers.onMessage(JSON.stringify({kind: 'hello'}))

                return {
                    sendRaw() {
                        events.push('send')
                    },
                    disconnect(reason) {
                        handlers.onClose(reason)
                    },
                }
            },
        }

        const runtime = createSocketRuntime({
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
                    serverName: 'socket-demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://socket.local'},
                    ],
                },
            ],
        })

        runtime.registerProfile(defineSocketProfile<void, {token: string}, Record<string, string>, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/socket',
            handshake: {
                query: typed<{token: string}>('demo.socket.query'),
                headers: typed<Record<string, string>>('demo.socket.headers'),
            },
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {
                reconnectAttempts: 1,
            },
        }))

        runtime.on('demo.socket', 'connected', () => {
            events.push('connected')
        })
        runtime.on<{kind: string}>('demo.socket', 'message', event => {
            if (event.type === 'message') {
                events.push(`message:${event.message.kind}`)
            }
        })
        runtime.on('demo.socket', 'disconnected', () => {
            events.push('disconnected')
        })
        const resolved = await runtime.connect('demo.socket', {
            query: {token: 't-1'},
            headers: {authorization: 'Bearer token'},
        })

        expect(resolved.selectedAddress.addressName).toBe('primary')
        expect(runtime.getConnectionState('demo.socket')).toBe('connected')

        runtime.send('demo.socket', {kind: 'ping'})
        runtime.disconnect('demo.socket', 'transport closed')

        expect(handlersRef).toBeDefined()
        expect(events).toContain('connected')
        expect(events).toContain('message:hello')
        expect(events).toContain('send')
        expect(events).toContain('disconnected')
    })

    it('builds ws urls without relying on URL parsing for websocket schemes', () => {
        expect(buildSocketUrl(
            'http://127.0.0.1:8888',
            '/mockMasterServer/ws',
        )).toBe('ws://127.0.0.1:8888/mockMasterServer/ws')

        expect(buildSocketUrl(
            'https://127.0.0.1:8888/',
            '/mockMasterServer/ws',
            undefined,
            {
                ticket: 'ticket-001',
                values: ['a', 'b'],
            },
        )).toBe('wss://127.0.0.1:8888/mockMasterServer/ws?ticket=ticket-001&values=a&values=b')
    })

    it('keeps explicitly replaced servers across connect-time refreshes', async () => {
        const connections: string[] = []
        const runtime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async connect(connection, handlers) {
                    connections.push(connection.url)
                    handlers.onOpen()
                    return {
                        sendRaw() {},
                        disconnect() {},
                    }
                },
            },
            servers: [],
        })

        runtime.registerProfile(defineSocketProfile<void, void, void, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/socket',
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {},
        }))
        runtime.replaceServers([{
            serverName: 'socket-demo',
            addresses: [
                {addressName: 'dynamic', baseUrl: 'http://127.0.0.1:18889'},
            ],
        }])

        await runtime.connect('demo.socket')

        expect(connections).toEqual(['ws://127.0.0.1:18889/socket'])
    })

    it('fails over to the next address when the first socket address cannot connect', async () => {
        const attempts: string[] = []
        const runtime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async connect(connection, handlers) {
                    attempts.push(connection.selectedAddress.addressName)
                    if (connection.selectedAddress.addressName === 'lan') {
                        throw new Error('lan unreachable')
                    }
                    handlers.onOpen()
                    return {
                        sendRaw() {},
                        disconnect() {},
                    }
                },
            },
            servers: [
                {
                    serverName: 'socket-demo',
                    addresses: [
                        {addressName: 'lan', baseUrl: 'http://192.168.0.172:5810'},
                        {addressName: 'local', baseUrl: 'http://127.0.0.1:5810'},
                    ],
                },
            ],
        })

        runtime.registerProfile(defineSocketProfile<void, void, void, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/socket',
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {},
        }))

        const firstResolved = await runtime.connect('demo.socket')
        const secondResolved = await runtime.connect('demo.socket')

        expect(firstResolved.selectedAddress.addressName).toBe('local')
        expect(secondResolved.selectedAddress.addressName).toBe('local')
        expect(attempts).toEqual(['lan', 'local', 'local'])
    })

    it('updates an existing profile without dropping listeners', async () => {
        const events: string[] = []
        const connections: string[] = []
        const runtime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async connect(connection, handlers) {
                    connections.push(connection.url)
                    handlers.onOpen()
                    return {
                        sendRaw() {},
                        disconnect() {},
                    }
                },
            },
            servers: [
                {
                    serverName: 'socket-demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://127.0.0.1:18889'},
                    ],
                },
            ],
        })

        runtime.registerProfile(defineSocketProfile<void, void, void, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/old',
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {},
        }))
        runtime.on('demo.socket', 'connected', () => {
            events.push('connected')
        })
        runtime.registerProfile(defineSocketProfile<void, void, void, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/new',
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {},
        }))

        await runtime.connect('demo.socket')

        expect(connections).toEqual(['ws://127.0.0.1:18889/new'])
        expect(events).toEqual(['connected'])
    })

    it('throws structured runtime error when profile is not registered', async () => {
        const runtime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            transport: {
                async connect() {
                    throw new Error('should not connect')
                },
            },
            servers: [
                {
                    serverName: 'socket-demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://socket.local'},
                    ],
                },
            ],
        })

        await expect(runtime.connect('missing.profile')).rejects.toMatchObject({
            key: 'kernel.base.transport-runtime.socket_runtime_failed',
            category: 'NETWORK',
        })
    })

    it('exposes stable socket parameter defaults', () => {
        expect(transportRuntimeParameterDefinitions.socketReconnectAttempts.defaultValue).toBe(0)
        expect(transportRuntimeParameterDefinitions.socketReconnectAttempts.validate?.(0)).toBe(true)
        expect(transportRuntimeParameterDefinitions.socketReconnectAttempts.validate?.(-2)).toBe(false)

        expect(transportRuntimeParameterDefinitions.socketReconnectDelayMs.defaultValue).toBe(1_000)
        expect(transportRuntimeParameterDefinitions.socketConnectionTimeoutMs.defaultValue).toBe(10_000)
        expect(transportRuntimeParameterDefinitions.socketHeartbeatIntervalMs.defaultValue).toBe(30_000)
        expect(transportRuntimeParameterDefinitions.socketHeartbeatTimeoutMs.defaultValue).toBe(60_000)
    })

    it('marks socket disconnected on error and does not count unsent messages', async () => {
        const metrics = vi.fn()
        let handlersRef: Parameters<SocketTransport['connect']>[1] | undefined

        const runtime = createSocketRuntime({
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: () => {},
                scope: {
                    moduleName: 'kernel.base.transport-runtime.test',
                    layer: 'kernel',
                },
            }),
            metricsRecorder: {
                recordConnection: metrics,
            },
            transport: {
                async connect(_connection, handlers) {
                    handlersRef = handlers
                    return {
                        sendRaw() {},
                        disconnect() {},
                    }
                },
            },
            servers: [
                {
                    serverName: 'socket-demo',
                    addresses: [
                        {addressName: 'primary', baseUrl: 'http://socket.local'},
                    ],
                },
            ],
        })

        runtime.registerProfile(defineSocketProfile<void, void, void, {kind: string}, {kind: string}>({
            name: 'demo.socket',
            serverName: 'socket-demo',
            pathTemplate: '/socket',
            handshake: {},
            messages: {
                incoming: typed<{kind: string}>('demo.socket.incoming'),
                outgoing: typed<{kind: string}>('demo.socket.outgoing'),
            },
            codec: new JsonSocketCodec<{kind: string}, {kind: string}>(),
            meta: {},
        }))

        runtime.send('demo.socket', {kind: 'ignored'})
        await runtime.connect('demo.socket')
        handlersRef?.onOpen()
        handlersRef?.onError(new Error('socket boom'))

        expect(runtime.getConnectionState('demo.socket')).toBe('disconnected')
        expect(metrics).toHaveBeenCalledWith(expect.objectContaining({
            outboundMessageCount: 0,
            success: false,
        }))
    })
})
