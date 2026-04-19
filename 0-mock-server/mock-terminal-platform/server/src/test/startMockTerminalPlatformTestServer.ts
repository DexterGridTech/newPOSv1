const READY_PREFIX = '[mock-terminal-platform:test-ready]'
const ERROR_PREFIX = '[mock-terminal-platform:test-error]'

let server:
  | Awaited<typeof import('./createMockTerminalPlatformTestServer.js')>['createMockTerminalPlatformTestServer'] extends (...args: never[]) => infer T
    ? T
    : never
  | undefined

let closing = false

const closeAndExit = async (code: number) => {
  if (closing) {
    return
  }
  closing = true
  try {
    await server?.close()
  } catch (error) {
    console.error(`${ERROR_PREFIX}${JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    })}`)
  } finally {
    process.exit(code)
  }
}

const installSignalHandlers = () => {
  process.on('SIGINT', () => {
    void closeAndExit(0)
  })
  process.on('SIGTERM', () => {
    void closeAndExit(0)
  })
}

const main = async () => {
  installSignalHandlers()
  try {
    const { createMockTerminalPlatformTestServer } = await import('./createMockTerminalPlatformTestServer.js')
    server = createMockTerminalPlatformTestServer()
    await server.start()
    process.stdout.write(`${READY_PREFIX}${JSON.stringify({
      baseUrl: server.getHttpBaseUrl(),
    })}\n`)
  } catch (error) {
    process.stderr.write(`${ERROR_PREFIX}${JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
    })}\n`)
    await closeAndExit(1)
  }
}

void main()
