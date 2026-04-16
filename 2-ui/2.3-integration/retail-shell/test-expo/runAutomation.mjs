import {execFile, spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {adminLauncherDefaults} from '../../../2.1-base/admin-console/src/foundations/launcherDefaults.ts'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.RETAIL_SHELL_EXPO_PORT ?? '8095')
const headed = process.env.RETAIL_SHELL_EXPO_HEADED === '1'
const slowMs = Number(process.env.RETAIL_SHELL_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.RETAIL_SHELL_EXPO_FINAL_PAUSE_MS ?? '0')

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
        const ready = await evalInBrowser(session, `Boolean(document.body.innerText.includes('Retail Shell Test Expo'))`)
        if (ready) {
            return
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for retail-shell Expo page in ${session}`)
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

const rapidClickRootLauncher = async (session, times = adminLauncherDefaults.requiredPresses) => {
    await evalInBrowser(session, `(() => {
        const node = document.querySelector('[data-testid="ui-integration-retail-shell:root"]')
        if (!node) {
            throw new Error('Missing testID: ui-integration-retail-shell:root')
        }
        const rect = node.getBoundingClientRect()
        for (let index = 0; index < ${times}; index += 1) {
            const event = new MouseEvent('click', {
                bubbles: true,
                clientX: rect.left + 12,
                clientY: rect.top + 12,
                screenX: rect.left + 12,
                screenY: rect.top + 12,
            })
            node.dispatchEvent(event)
        }
        return true
    })()`)
    await delay(Math.max(200, slowMs))
}

const readState = async (session) => evalInBrowser(session, `JSON.stringify({
    ready: Boolean(document.querySelector('[data-testid="ui-integration-retail-shell-expo:ready"]')),
    activationCode: document.querySelector('[data-testid="ui-integration-retail-shell-expo:activation-code"]')?.textContent ?? null,
    activationStatus: document.querySelector('[data-testid="ui-integration-retail-shell-expo:activation-status"]')?.textContent ?? null,
    terminalId: document.querySelector('[data-testid="ui-integration-retail-shell-expo:terminal-id"]')?.textContent ?? null,
    activationMessage: document.querySelector('[data-testid="ui-base-terminal-activate-device:message"]')?.textContent ?? null,
    activationInputValue: document.querySelector('[data-testid="ui-base-terminal-activate-device:value"]')?.textContent ?? null,
    welcomeVisible: Boolean(document.querySelector('[data-testid="ui-integration-retail-shell:welcome"]')),
    welcomeTerminalId: document.querySelector('[data-testid="ui-integration-retail-shell:welcome:terminal-id"]')?.textContent ?? null,
    adminLoginVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:login"]')),
    adminPanelVisible: Boolean(document.querySelector('[data-testid="ui-base-admin-popup:panel"]')),
    selectedTab: document.querySelector('[data-testid="ui-base-admin-popup:selected-tab"]')?.textContent ?? null,
    keyboardVisible: Boolean(document.querySelector('[data-testid="ui-base-virtual-keyboard"]')),
    keyboardTitle: document.querySelector('[data-testid="ui-base-virtual-keyboard:title"]')?.textContent ?? null,
    adminPassword: document.querySelector('[data-testid="ui-integration-retail-shell-expo:admin-password"]')?.textContent ?? null,
})`)

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. actual=${JSON.stringify(actual)}`)
        }
    }
}

const waitForState = async (session, predicate, label, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs
    let lastState = null
    while (Date.now() < deadline) {
        const state = await readState(session)
        lastState = state
        if (predicate(state)) {
            return state
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for ${label}. lastState=${JSON.stringify(lastState)}`)
}

const createMockPlatform = async () => {
    const script = `
        import {createMockTerminalPlatformTestServer} from '${resolve(repoRoot, '0-mock-server/mock-terminal-platform/server/src/test/createMockTerminalPlatformTestServer.ts').replaceAll('\\', '\\\\')}';
        const server = createMockTerminalPlatformTestServer();
        await server.start();
        const baseUrl = server.getHttpBaseUrl();
        const response = await fetch(baseUrl + '/mock-debug/kernel-base-test/prepare', {method: 'POST'});
        if (!response.ok) {
          throw new Error('prepare sandbox failed: ' + response.status);
        }
        console.log(JSON.stringify({baseUrl}));
        process.on('SIGTERM', async () => { await server.close(); process.exit(0); });
        process.on('SIGINT', async () => { await server.close(); process.exit(0); });
        setInterval(() => {}, 1000);
    `
    const child = spawn(process.execPath, ['--import', 'tsx', '--eval', script], {
        cwd: repoRoot,
        detached: true,
        env: {
            ...process.env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    const lines = []
    const baseUrl = await new Promise((resolvePromise, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timed out waiting for mock platform boot: ${lines.join('')}`))
        }, 30000)
        const onData = chunk => {
            const text = chunk.toString()
            lines.push(text)
            const match = text.match(/\{\"baseUrl\":\"([^\"]+)\"\}/)
            if (match?.[1]) {
                clearTimeout(timeout)
                resolvePromise(match[1])
            }
        }
        child.stdout.on('data', onData)
        child.stderr.on('data', onData)
        child.once('error', reject)
    })
    return {
        baseUrl,
        child,
        async stop() {
            try {
                process.kill(child.pid, 'SIGTERM')
            } catch {
                try {
                    child.kill('SIGTERM')
                } catch {
                    // best-effort
                }
            }
        },
    }
}

const startExpo = async (port, mockPlatformBaseUrl) => {
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
            EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL: mockPlatformBaseUrl,
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

const startExpoWithRetry = async (startPort, mockPlatformBaseUrl, attempts = 5) => {
    let port = startPort
    let lastError
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await startExpo(await findFreePort(port), mockPlatformBaseUrl)
        } catch (error) {
            lastError = error
            port += 1
        }
    }
    throw lastError ?? new Error(`Unable to start Expo after ${attempts} attempts`)
}

const main = async () => {
    await runAgent(['skills', 'get', 'agent-browser'])
    const mockPlatform = await createMockPlatform()
    const expo = await startExpoWithRetry(preferredPort, mockPlatform.baseUrl)
    const baseUrl = `http://localhost:${expo.port}`
    const session = `retail-shell-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)
        await assertRuntimeLogsPresent(session, [
            'kernel-runtime-app-v2-created',
            'ui-base-runtime-react-install',
            'kernel-base-tcp-control-runtime-v2-install',
            'ui-base-admin-console-install',
            'ui-base-terminal-console-install',
            'ui-integration-retail-shell-install',
        ], 'boot logs')

        const initial = await readState(session)
        expectState(initial, {
            ready: true,
            activationStatus: 'UNACTIVATED',
            welcomeVisible: false,
            adminLoginVisible: false,
        }, 'boot')

        if (!initial.activationCode) {
            throw new Error(`missing activation code on boot: ${JSON.stringify(initial)}`)
        }

        await clickTestId(session, 'ui-base-terminal-activate-device:input')
        expectState(await readState(session), {
            keyboardVisible: true,
            keyboardTitle: '激活码键盘',
        }, 'activation keyboard open')

        for (const char of initial.activationCode.split('')) {
            await clickTestId(session, `ui-base-virtual-keyboard:key:${char}`)
        }
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')

        const inputReady = await readState(session)
        if (!inputReady.activationInputValue?.includes(initial.activationCode)) {
            throw new Error(`activation input did not receive code: ${JSON.stringify(inputReady)}`)
        }

        await clickTestId(session, 'ui-base-terminal-activate-device:submit')

        const activated = await waitForState(
            session,
            state => state.activationStatus === 'ACTIVATED' && state.welcomeVisible === true,
            'activation success and welcome switch',
        )

        if (!activated.welcomeTerminalId || activated.welcomeTerminalId === 'terminal:unactivated') {
            throw new Error(`welcome terminal id missing after activation: ${JSON.stringify(activated)}`)
        }

        await rapidClickRootLauncher(session)
        expectState(await waitForState(
            session,
            state => state.adminLoginVisible === true,
            'admin login open',
        ), {
            adminLoginVisible: true,
        }, 'admin login open')

        await clickTestId(session, 'ui-base-admin-popup:password')
        expectState(await readState(session), {
            keyboardVisible: true,
        }, 'admin keyboard open')

        const derivedPassword = (await readState(session)).adminPassword

        if (!derivedPassword) {
            throw new Error('missing derived admin password from expo shell')
        }

        for (const digit of String(derivedPassword).split('')) {
            await clickTestId(session, `ui-base-virtual-keyboard:key:${digit}`)
        }
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')
        await clickTestId(session, 'ui-base-admin-popup:submit')

        expectState(await waitForState(
            session,
            state => state.adminPanelVisible === true,
            'admin panel open',
        ), {
            selectedTab: 'device',
        }, 'admin panel default tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:terminal')
        expectState(await readState(session), {
            selectedTab: 'terminal',
        }, 'terminal tab')

        await clickTestId(session, 'ui-base-admin-section:terminal:deactivate')

        expectState(await waitForState(
            session,
            state => state.activationStatus === 'UNACTIVATED' && state.welcomeVisible === false,
            'deactivation returns activation screen',
        ), {
            activationStatus: 'UNACTIVATED',
        }, 'after deactivation')

        if (finalPauseMs > 0) {
            await delay(finalPauseMs)
        }

        console.log(`retail-shell test-expo automation passed on ${baseUrl}`)
    } finally {
        try {
            await runAgent(['--session', session, 'close'])
        } catch {
            // best-effort
        }
        await expo.stop()
        await mockPlatform.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
