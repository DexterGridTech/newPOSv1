import type { AddressInfo } from 'node:net'
import type { Socket } from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../app/createApp.js'
import { initializeDatabase, resetDatabaseConnection } from '../database/index.js'
import { createHttpAndWsServer } from '../modules/tdp/wsServer.js'
import { resetOnlineSessions } from '../modules/tdp/wsSessionRegistry.js'

export interface MockTerminalPlatformTestServer {
  start(): Promise<void>
  close(): Promise<void>
  getAddressInfo(): AddressInfo
  getHttpBaseUrl(): string
  getTempDir(): string
}

export const createMockTerminalPlatformTestServer = (): MockTerminalPlatformTestServer => {
  let server: ReturnType<typeof createHttpAndWsServer> | undefined
  let addressInfo: AddressInfo | undefined
  const sockets = new Set<Socket>()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-terminal-platform-test-'))
  const dbFile = path.join(tempDir, 'mock-terminal-platform.sqlite')

  return {
    async start() {
      if (server) {
        return
      }
      resetDatabaseConnection({ dataFile: dbFile })
      initializeDatabase()
      const app = createApp()
      server = createHttpAndWsServer(app)
      server.on('connection', socket => {
        sockets.add(socket)
        socket.once('close', () => {
          sockets.delete(socket)
        })
      })
      await new Promise<void>((resolve, reject) => {
        server?.once('error', reject)
        server?.listen(0, '127.0.0.1', () => {
          const address = server?.address()
          if (!address || typeof address === 'string') {
            reject(new Error('mock-terminal-platform test server did not expose an address'))
            return
          }
          addressInfo = address
          resolve()
        })
      })
    },
    async close() {
      if (!server) {
        return
      }
      const closing = server
      server = undefined
      addressInfo = undefined
      sockets.forEach(socket => {
        socket.destroy()
      })
      sockets.clear()
      await new Promise<void>((resolve, reject) => {
        closing.close(error => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
      resetOnlineSessions()
      resetDatabaseConnection()
      fs.rmSync(tempDir, {recursive: true, force: true})
    },
    getAddressInfo() {
      if (!addressInfo) {
        throw new Error('mock-terminal-platform test server is not started')
      }
      return addressInfo
    },
    getHttpBaseUrl() {
      const address = this.getAddressInfo()
      return `http://${address.address}:${address.port}`
    },
    getTempDir() {
      return tempDir
    },
  }
}
