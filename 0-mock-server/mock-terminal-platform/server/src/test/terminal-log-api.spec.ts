import {afterEach, describe, expect, it} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'
import {createMockTerminalPlatformTestServer} from './createMockTerminalPlatformTestServer.js'

const servers: Array<ReturnType<typeof createMockTerminalPlatformTestServer>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

const createTerminal = async (baseUrl: string, sandboxId: string) => {
  const activationResponse = await fetch(`${baseUrl}/api/v1/admin/activation-codes/batch`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId,
      count: 1,
    }),
  })
  const activationPayload = await activationResponse.json() as {
    success: boolean
    data: {
      codes: string[]
    }
  }
  const activationCode = activationPayload.data.codes[0]
  if (!activationCode) {
    throw new Error('failed to create activation code for test terminal')
  }

  const terminalResponse = await fetch(`${baseUrl}/api/v1/terminals/activate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      sandboxId,
      activationCode,
      deviceFingerprint: `device-${Date.now()}`,
      deviceInfo: {
        id: `device-${Date.now()}`,
        model: 'TEST-DEVICE',
      },
    }),
  })
  const terminalPayload = await terminalResponse.json() as {
    success: boolean
    data: {
      terminalId: string
      token: string
    }
  }
  return terminalPayload.data
}

describe('mock-terminal-platform terminal log api', () => {
  it('delivers remote-control commands only to sessions subscribed to the command topic', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const baseUrl = server.getHttpBaseUrl()
    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(baseUrl, sandboxId)
    const wsBaseUrl = baseUrl.replace('http://', 'ws://')

    const connectSession = async (subscribedTopics: string[]) => {
      const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
      const messages: Array<{type?: string; data?: Record<string, unknown>}> = []
      socket.on('message', raw => {
        messages.push(JSON.parse(raw.toString()) as {type?: string; data?: Record<string, unknown>})
      })
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close()
          reject(new Error('timed out waiting for subscribed session ready'))
        }, 3_000)
        socket.once('open', () => {
          socket.send(JSON.stringify({
            type: 'HANDSHAKE',
            data: {
              sandboxId,
              terminalId,
              appVersion: 'test-app',
              protocolVersion: '1.0',
              lastCursor: 999_999,
              capabilities: [
                'tdp.topic-subscription.v1',
              ],
              subscribedTopics,
              subscriptionMode: 'explicit',
              subscriptionVersion: 1,
            },
          }))
        })
        socket.on('message', raw => {
          const payload = JSON.parse(raw.toString()) as {type?: string}
          if (payload.type === 'SESSION_READY') {
            clearTimeout(timeout)
            resolve()
          }
        })
        socket.once('error', error => {
          clearTimeout(timeout)
          reject(error)
        })
      })
      return {
        socket,
        messages,
      }
    }

    const subscribed = await connectSession(['remote.control'])
    const unsubscribed = await connectSession(['org.store.profile'])

    const requestResponse = await fetch(`${baseUrl}/api/v1/admin/terminals/${terminalId}/log-fetches`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        sandboxId,
        logDate: '2026-04-23',
        overwrite: true,
      }),
    })
    expect(requestResponse.status).toBe(201)
    const requestPayload = await requestResponse.json() as {
      data: {
        instanceId?: string
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(subscribed.messages.some(message => message.type === 'COMMAND_DELIVERED')).toBe(true)
    expect(unsubscribed.messages.some(message => message.type === 'COMMAND_DELIVERED')).toBe(false)

    const instancesResponse = await fetch(`${baseUrl}/api/v1/admin/tasks/instances?sandboxId=${sandboxId}`)
    const instancesPayload = await instancesResponse.json() as {
      data: Array<{
        instanceId: string
        deliveryStatus: string
      }>
    }
    expect(instancesPayload.data.find(item => item.instanceId === requestPayload.data.instanceId)?.deliveryStatus).toBe('DELIVERED')

    subscribed.socket.close()
    unsubscribed.socket.close()
  })

  it('creates remote-control release for terminal log fetch and records uploaded log metadata', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const baseUrl = server.getHttpBaseUrl()
    const sandboxId = 'sandbox-default'
    const {terminalId} = await createTerminal(baseUrl, sandboxId)

    const requestResponse = await fetch(`${baseUrl}/api/v1/admin/terminals/${terminalId}/log-fetches`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        sandboxId,
        logDate: '2026-04-22',
        overwrite: true,
      }),
    })
    const requestPayload = await requestResponse.json() as {
      success: boolean
      data: {
        release: {
          releaseId: string
          payload: {
            commandType: string
            uploadUrl: string
            logDate: string
            overwrite: boolean
          }
        }
        instanceId?: string
      }
    }

    expect(requestResponse.status).toBe(201)
    expect(requestPayload.success).toBe(true)
    expect(requestPayload.data.release.payload).toMatchObject({
      commandType: 'UPLOAD_TERMINAL_LOGS',
      logDate: '2026-04-22',
      overwrite: true,
    })
    expect(requestPayload.data.release.payload.uploadUrl).toContain(`/api/v1/terminals/${terminalId}/log-files/upload`)

    const uploadResponse = await fetch(`${baseUrl}/api/v1/terminals/${terminalId}/log-files/upload`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        sandboxId,
        terminalId,
        logDate: '2026-04-22',
        displayIndex: 0,
        displayRole: 'PRIMARY',
        fileName: '2026-04-22-js.log',
        contentType: 'text/plain',
        contentBase64: Buffer.from('terminal-js-log-content').toString('base64'),
        commandId: 'command-001',
        instanceId: requestPayload.data.instanceId,
        releaseId: requestPayload.data.release.releaseId,
        metadata: {
          source: 'unit-test',
        },
      }),
    })
    const uploadPayload = await uploadResponse.json() as {
      success: boolean
      data: {
        fileName: string
        displayRole: string
        fileSize: number
        storagePath: string
        sha256: string
        metadata: Record<string, unknown>
      }
    }

    expect(uploadResponse.status).toBe(201)
    expect(uploadPayload.success).toBe(true)
    expect(uploadPayload.data).toMatchObject({
      fileName: '2026-04-22-js.log',
      displayRole: 'PRIMARY',
      fileSize: 'terminal-js-log-content'.length,
      metadata: {
        source: 'unit-test',
      },
    })
    expect(fs.existsSync(uploadPayload.data.storagePath)).toBe(true)
    expect(fs.readFileSync(uploadPayload.data.storagePath, 'utf8')).toBe('terminal-js-log-content')

    const slaveUploadResponse = await fetch(`${baseUrl}/api/v1/terminals/${terminalId}/log-files/upload`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        sandboxId,
        terminalId,
        logDate: '2026-04-22',
        displayIndex: 0,
        displayRole: 'SLAVE',
        fileName: '2026-04-22-js.log',
        contentType: 'text/plain',
        contentBase64: Buffer.from('terminal-js-log-content-slave').toString('base64'),
        commandId: 'command-002',
        instanceId: requestPayload.data.instanceId,
        releaseId: requestPayload.data.release.releaseId,
        metadata: {
          source: 'unit-test-slave',
        },
      }),
    })
    const slaveUploadPayload = await slaveUploadResponse.json() as {
      success: boolean
      data: {
        fileName: string
        displayRole: string
        fileSize: number
        storagePath: string
      }
    }

    expect(slaveUploadResponse.status).toBe(201)
    expect(slaveUploadPayload.success).toBe(true)
    expect(slaveUploadPayload.data).toMatchObject({
      fileName: '2026-04-22-js.log',
      displayRole: 'SLAVE',
      fileSize: 'terminal-js-log-content-slave'.length,
    })
    expect(fs.existsSync(slaveUploadPayload.data.storagePath)).toBe(true)
    expect(fs.readFileSync(slaveUploadPayload.data.storagePath, 'utf8')).toBe('terminal-js-log-content-slave')

    const listResponse = await fetch(`${baseUrl}/api/v1/admin/terminals/${terminalId}/log-files?sandboxId=${sandboxId}`)
    const listPayload = await listResponse.json() as {
      success: boolean
      data: Array<{
        fileName: string
        displayRole: string
        storagePath: string
        releaseId: string | null
        metadata: Record<string, unknown>
      }>
    }

    expect(listResponse.status).toBe(200)
    expect(listPayload.success).toBe(true)
    expect(listPayload.data).toHaveLength(2)
    expect(listPayload.data.find((item) => item.displayRole === 'PRIMARY')).toMatchObject({
      fileName: '2026-04-22-js.log',
      displayRole: 'PRIMARY',
      releaseId: requestPayload.data.release.releaseId,
      metadata: {
        source: 'unit-test',
      },
    })
    expect(listPayload.data.find((item) => item.displayRole === 'SLAVE')).toMatchObject({
      fileName: '2026-04-22-js.log',
      displayRole: 'SLAVE',
      releaseId: requestPayload.data.release.releaseId,
      metadata: {
        source: 'unit-test-slave',
      },
    })
    expect(path.isAbsolute(listPayload.data[0]!.storagePath)).toBe(true)

    const resultResponse = await fetch(`${baseUrl}/api/v1/terminals/${terminalId}/tasks/${requestPayload.data.instanceId}/result`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        sandboxId,
        status: 'COMPLETED',
        result: {
          uploadedFiles: listPayload.data.map((item) => ({
            displayRole: item.displayRole,
            fileName: item.fileName,
          })),
        },
      }),
    })
    const resultPayload = await resultResponse.json() as {
      success: boolean
      data: {
        instanceId: string
        status: string
        releaseId: string
        releaseStatus: string
      }
    }

    expect(resultResponse.status).toBe(200)
    expect(resultPayload.success).toBe(true)
    expect(resultPayload.data).toMatchObject({
      instanceId: requestPayload.data.instanceId,
      status: 'COMPLETED',
      releaseId: requestPayload.data.release.releaseId,
      releaseStatus: 'COMPLETED',
    })

    const releasesResponse = await fetch(`${baseUrl}/api/v1/admin/tasks/releases?sandboxId=${sandboxId}`)
    const releasesPayload = await releasesResponse.json() as {
      success: boolean
      data: Array<{
        releaseId: string
        status: string
      }>
    }
    expect(releasesPayload.data.find((item) => item.releaseId === requestPayload.data.release.releaseId)?.status).toBe('COMPLETED')
  })

  it('delivers terminal log upload command only to the master session when both master and slave are online', async () => {
    const server = createMockTerminalPlatformTestServer()
    servers.push(server)
    await server.start()

    const baseUrl = server.getHttpBaseUrl()
    const sandboxId = 'sandbox-default'
    const {terminalId, token} = await createTerminal(baseUrl, sandboxId)
    expect(token).toBeTruthy()

    const wsBaseUrl = baseUrl.replace('http://', 'ws://')
    const connectTerminalSession = async (runtimeIdentity: {
      localNodeId: string
      displayIndex: number
      displayCount: number
      instanceMode: 'MASTER' | 'SLAVE'
      displayMode: 'PRIMARY' | 'SECONDARY'
    }) => {
      const socket = new WebSocket(`${wsBaseUrl}/api/v1/tdp/ws/connect?sandboxId=${sandboxId}&terminalId=${terminalId}&token=${token}`)
      const commandMessages: Array<{commandId: string; payload: Record<string, unknown>}> = []

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.close()
          reject(new Error(`timed out waiting for session ready: ${runtimeIdentity.localNodeId}`))
        }, 3000)

        socket.once('open', () => {
          socket.send(JSON.stringify({
            type: 'HANDSHAKE',
            data: {
              sandboxId,
              terminalId,
              appVersion: 'test-app',
              protocolVersion: '1.0',
              runtimeIdentity,
            },
          }))
        })

        socket.on('message', (raw) => {
          const payload = JSON.parse(raw.toString()) as {type?: string; data?: Record<string, unknown>}
          if (payload.type === 'SESSION_READY') {
            clearTimeout(timeout)
            resolve()
          }
          if (payload.type === 'COMMAND_DELIVERED' && payload.data) {
            commandMessages.push({
              commandId: String(payload.data.commandId ?? ''),
              payload: (payload.data.payload ?? {}) as Record<string, unknown>,
            })
          }
        })

        socket.once('error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      return {
        socket,
        commandMessages,
      }
    }

    const masterSession = await connectTerminalSession({
      localNodeId: 'master:test-node',
      displayIndex: 0,
      displayCount: 2,
      instanceMode: 'MASTER',
      displayMode: 'PRIMARY',
    })
    const slaveSession = await connectTerminalSession({
      localNodeId: 'slave:test-node',
      displayIndex: 1,
      displayCount: 2,
      instanceMode: 'SLAVE',
      displayMode: 'SECONDARY',
    })

    try {
      const requestResponse = await fetch(`${baseUrl}/api/v1/admin/terminals/${terminalId}/log-fetches`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          sandboxId,
          logDate: '2026-04-23',
          overwrite: true,
        }),
      })
      expect(requestResponse.status).toBe(201)

      await new Promise(resolve => setTimeout(resolve, 300))

      expect(masterSession.commandMessages).toHaveLength(1)
      expect(masterSession.commandMessages[0]?.payload.commandType).toBe('UPLOAD_TERMINAL_LOGS')
      expect(slaveSession.commandMessages).toHaveLength(0)
    } finally {
      masterSession.socket.close()
      slaveSession.socket.close()
    }
  })
})
