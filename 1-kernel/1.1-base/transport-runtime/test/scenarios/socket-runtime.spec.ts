import {describe, expect, it} from 'vitest'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
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
})
