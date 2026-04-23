import {afterEach, describe, expect, it} from 'vitest'
import WebSocket from 'ws'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

describe('mock-terminal-platform sandbox API guards', () => {
    it('rejects activate terminal when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/terminals/activate`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                activationCode: '123456789012',
                deviceFingerprint: 'demo-pos',
                deviceInfo: {
                    id: 'demo-pos',
                },
            }),
        })

        const payload = await response.json() as {
            success: boolean
            error?: {
                message?: string
            }
        }

        expect(response.status).toBe(400)
        expect(payload.success).toBe(false)
        expect(payload.error?.message ?? '').toContain('SANDBOX_ID_REQUIRED')
    })

    it('rejects TDP snapshot when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/tdp/terminals/demo-terminal/snapshot`)
        const payload = await response.json() as {
            success: boolean
            error?: {
                message?: string
            }
        }

        expect(response.status).toBe(400)
        expect(payload.success).toBe(false)
        expect(payload.error?.message ?? '').toContain('SANDBOX_ID_REQUIRED')
    })

    it('rejects master-data list when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/master-data/platforms`)
        const payload = await response.json() as {
            success: boolean
            error?: {
                message?: string
            }
        }

        expect(response.status).toBe(400)
        expect(payload.success).toBe(false)
        expect(payload.error?.message ?? '').toContain('SANDBOX_ID_REQUIRED')
    })

    it('rejects export when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const response = await fetch(`${server.getHttpBaseUrl()}/api/v1/admin/export`)
        const payload = await response.json() as {
            success: boolean
            error?: {
                message?: string
            }
        }

        expect(response.status).toBe(400)
        expect(payload.success).toBe(false)
        expect(payload.error?.message ?? '').toContain('SANDBOX_ID_REQUIRED')
    })

    it('rejects fault rule list when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const response = await fetch(`${server.getHttpBaseUrl()}/mock-admin/fault-rules`)
        const payload = await response.json() as {
            success: boolean
            error?: {
                message?: string
            }
        }

        expect(response.status).toBe(400)
        expect(payload.success).toBe(false)
        expect(payload.error?.message ?? '').toContain('SANDBOX_ID_REQUIRED')
    })

    it('rejects TDP WebSocket handshake when sandboxId is missing', async () => {
        const server = createMockTerminalPlatformTestServer()
        servers.push(server)
        await server.start()

        const wsUrl = server.getHttpBaseUrl()
            .replace('http://', 'ws://')
            .concat('/api/v1/tdp/ws/connect?terminalId=demo-terminal&token=demo-token')
        const socket = new WebSocket(wsUrl)

        const result = await new Promise<{message?: string; closeCode?: number}>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.close()
                reject(new Error('timed out waiting for websocket sandbox rejection'))
            }, 2000)
            socket.once('open', () => {
                socket.send(JSON.stringify({
                    type: 'HANDSHAKE',
                    data: {
                        terminalId: 'demo-terminal',
                        appVersion: 'test-app',
                    },
                }))
            })
            socket.once('message', (data) => {
                const payload = JSON.parse(data.toString()) as {
                    type?: string
                    error?: {
                        code?: string
                        message?: string
                    }
                }
                clearTimeout(timeout)
                resolve({
                    message: payload.error?.message ?? payload.error?.code,
                })
            })
            socket.once('close', (code) => {
                clearTimeout(timeout)
                resolve({closeCode: code})
            })
            socket.once('error', reject)
        })

        expect(result.message ?? '').toContain('sandboxId')
    })
})
