import {execFile} from 'node:child_process'
import {createServer} from 'node:net'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.ADMIN_CONSOLE_EXPO_PORT ?? '8093')
const headed = process.env.ADMIN_CONSOLE_EXPO_HEADED === '1'
const slowMs = Number(process.env.ADMIN_CONSOLE_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.ADMIN_CONSOLE_EXPO_FINAL_PAUSE_MS ?? '0')
const adminLauncherRequiredPresses = 5

const run = (command, args, options = {}) => new Promise((resolvePromise, reject) => {
    execFile(command, args, {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024 * 20,
        ...options,
    }, (error, stdout, stderr) => {
        if (error) {
            error.stdout = stdout
            error.stderr = stderr
            reject(error)
            return
        }
        resolvePromise({stdout, stderr})
    })
})

const runAgent = async (args, options = {}) => {
    const globalArgs = headed ? ['--headed'] : []
    const result = await run('agent-browser', [...globalArgs, ...args], options)
    return result.stdout.trim()
}

const parseEvalResult = (stdout) => {
    const value = JSON.parse(stdout.trim())
    return typeof value === 'string' ? JSON.parse(value) : value
}

const evalInBrowser = async (session, expression) => {
    const stdout = await runAgent(['--session', session, 'eval', expression])
    return parseEvalResult(stdout)
}

const findFreePort = async (startPort) => {
    for (let port = startPort; port < startPort + 50; port += 1) {
        const available = await new Promise((resolvePromise) => {
            const server = createServer()
            server.once('error', () => resolvePromise(false))
            server.once('listening', () => {
                server.close(() => resolvePromise(true))
            })
            server.listen(port)
        })
        if (available) {
            return port
        }
    }
    throw new Error(`No free port found from ${startPort}`)
}

const waitForHttp = async (url, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url)
            if (response.ok) {
                return
            }
        } catch {
            // retry
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for ${url}`)
}

const waitForExpoReady = async (logs, port, timeoutMs = 30000) => {
    const marker = `Waiting on http://localhost:${port}`
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const combined = logs.join('')
        if (combined.includes(marker)) {
            return
        }
        if (combined.includes('Use port') || combined.includes('Skipping dev server')) {
            throw new Error(`Expo failed to bind port ${port}: ${combined}`)
        }
        await delay(250)
    }
    throw new Error(`Timed out waiting for Expo readiness on ${port}: ${logs.join('')}`)
}

const waitForPageReady = async (session) => {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        const ready = await evalInBrowser(session, `Boolean(document.body.innerText.includes('Admin Console Test Expo'))`)
        if (ready) {
            return
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for admin-console Expo page in ${session}`)
}

const assertRuntimeLogsPresent = async (session, expectedNeedles, label) => {
    const consoleText = await runAgent(['--session', session, 'console'])
    for (const needle of expectedNeedles) {
        if (!consoleText.includes(needle)) {
            throw new Error(`${label}: missing console log "${needle}". console=${consoleText}`)
        }
    }
}

const clickTestId = async (session, testId) => {
    await evalInBrowser(session, `(() => {
        const node = document.querySelector('[data-testid="${testId}"]')
        if (!node) {
            throw new Error('Missing testID: ${testId}')
        }
        node.click()
        return true
    })()`)
    await delay(Math.max(500, slowMs))
}

const rapidClickTestId = async (session, testId, times) => {
    await evalInBrowser(session, `(() => {
        const node = document.querySelector('[data-testid="${testId}"]')
        if (!node) {
            throw new Error('Missing testID: ${testId}')
        }
        for (let index = 0; index < ${times}; index += 1) {
            node.click()
        }
        return true
    })()`)
    await delay(Math.max(500, slowMs))
}

const readState = async (session) => evalInBrowser(session, `JSON.stringify({
    ready: Boolean(document.querySelector('[data-testid="ui-base-admin-console-expo:ready"]')),
    password: document.querySelector('[data-testid="ui-base-admin-console-expo:password"]')?.textContent ?? null,
    loginVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:login"]')),
    panelVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:panel"]')),
    runtimeGroupVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:group:runtime"]')),
    adapterGroupVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:group:adapter"]')),
    selectedTab: document.querySelector('[data-testid="ui-base-admin-popup:selected-tab"]')?.textContent ?? null,
    adapterVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-adapter-diagnostics"]')),
    deviceVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-section:device"]')),
    logsVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-section:logs"]')),
    connectorVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-section:connector"]')),
    terminalVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-section:terminal"]')),
    topologyVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-section:topology"]')),
    keyboardVisible: Boolean(document.querySelector('[data-testid="ui-base-virtual-keyboard"]')),
    adapterMessage: document.querySelector('[data-testid="ui-base-admin-adapter-diagnostics"]')?.textContent ?? null,
})`)

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. actual=${JSON.stringify(actual)}`)
        }
    }
}

const startExpo = async (port) => {
    const {spawn} = await import('node:child_process')
    const logs = []
    const server = spawn(process.execPath, [
        expoCli,
        'start',
        '--web',
        '--localhost',
        '--port',
        String(port),
        '--clear',
    ], {
        cwd: packageDir,
        detached: true,
        env: {
            ...process.env,
            CI: '1',
            EXPO_OFFLINE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    server.stdout.on('data', chunk => logs.push(chunk.toString()))
    server.stderr.on('data', chunk => logs.push(chunk.toString()))

    await waitForExpoReady(logs, port)
    await waitForHttp(`http://localhost:${port}`)

    return {
        server,
        port,
        async stop() {
            try {
                process.kill(server.pid, 'SIGTERM')
            } catch {
                try {
                    server.kill('SIGTERM')
                } catch {
                    // best-effort
                }
            }
        },
    }
}

const startExpoWithRetry = async (startPort, attempts = 5) => {
    let port = startPort
    let lastError
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await startExpo(await findFreePort(port))
        } catch (error) {
            lastError = error
            port += 1
        }
    }
    throw lastError ?? new Error(`Unable to start Expo after ${attempts} attempts`)
}

const main = async () => {
    await runAgent(['skills', 'get', 'agent-browser'])
    const expo = await startExpoWithRetry(preferredPort)
    const baseUrl = `http://localhost:${expo.port}`
    const session = `admin-console-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)
        await assertRuntimeLogsPresent(session, [
            'kernel-runtime-app-v2-created',
            'ui-base-runtime-react-install',
            'ui-base-admin-console-install',
        ], 'boot logs')

        const initial = await readState(session)
        expectState(initial, {
            ready: true,
            loginVisible: false,
            panelVisible: false,
        }, 'boot')

        await rapidClickTestId(
            session,
            'ui-base-admin-console-expo:launcher',
            adminLauncherRequiredPresses,
        )

        expectState(await readState(session), {
            loginVisible: true,
            keyboardVisible: false,
        }, 'launcher opens login')

        await clickTestId(session, 'ui-base-admin-popup:password')
        expectState(await readState(session), {
            keyboardVisible: true,
        }, 'password keyboard open')

        const password = (await readState(session)).password
        if (!password) {
            throw new Error('missing derived admin password from expo shell')
        }
        for (const digit of password.split('')) {
            await clickTestId(session, `ui-base-virtual-keyboard:key:${digit}`)
        }
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')
        await clickTestId(session, 'ui-base-admin-popup:submit')

        expectState(await readState(session), {
            panelVisible: true,
            runtimeGroupVisible: true,
            adapterGroupVisible: true,
            selectedTab: 'terminal',
            terminalVisible: true,
        }, 'panel open')

        await clickTestId(session, 'ui-base-admin-popup:tab:device')
        expectState(await readState(session), {
            selectedTab: 'device',
            deviceVisible: true,
        }, 'device tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:logs')
        expectState(await readState(session), {
            selectedTab: 'logs',
            logsVisible: true,
        }, 'logs tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:topology')
        expectState(await readState(session), {
            selectedTab: 'topology',
            topologyVisible: true,
        }, 'topology tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:connector')
        expectState(await readState(session), {
            selectedTab: 'connector',
            connectorVisible: true,
        }, 'connector tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:adapter')
        expectState(await readState(session), {
            selectedTab: 'adapter',
            adapterVisible: true,
        }, 'adapter tab')

        await clickTestId(session, 'ui-base-admin-adapter-diagnostics:run-all')
        const afterRun = await readState(session)
        if (!afterRun.adapterMessage?.includes('已完成 2 项测试')) {
            throw new Error(`adapter run result missing: ${JSON.stringify(afterRun)}`)
        }

        if (finalPauseMs > 0) {
            await delay(finalPauseMs)
        }

        console.log(`admin-console test-expo automation passed on ${baseUrl}`)
    } finally {
        try {
            await runAgent(['--session', session, 'close'])
        } catch {
            // best-effort
        }
        await expo.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
