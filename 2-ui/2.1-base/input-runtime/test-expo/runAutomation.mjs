import {execFile} from 'node:child_process'
import {createServer} from 'node:net'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.INPUT_RUNTIME_EXPO_PORT ?? '8092')
const headed = process.env.INPUT_RUNTIME_EXPO_HEADED === '1'
const slowMs = Number(process.env.INPUT_RUNTIME_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.INPUT_RUNTIME_EXPO_FINAL_PAUSE_MS ?? '0')

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
        await delay(250)
    }
    throw new Error(`Timed out waiting for Expo readiness on ${port}: ${logs.join('')}`)
}

const waitForPageReady = async (session) => {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        const ready = await evalInBrowser(session, `Boolean(document.body.innerText.includes('Input Runtime Test Expo'))`)
        if (ready) {
            return
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for input-runtime Expo page in ${session}`)
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

const readState = async (session) => evalInBrowser(session, `JSON.stringify({
    pageReady: document.body.innerText.includes('Input Runtime Test Expo'),
    systemValue: document.querySelector('[data-testid="ui-base-input-runtime-expo:system-text:value"]')?.textContent ?? null,
    pinValue: document.querySelector('[data-testid="ui-base-input-runtime-expo:pin:value"]')?.textContent ?? null,
    amountValue: document.querySelector('[data-testid="ui-base-input-runtime-expo:amount:value"]')?.textContent ?? null,
    activationValue: document.querySelector('[data-testid="ui-base-input-runtime-expo:activation:value"]')?.textContent ?? null,
    keyboardVisible: Boolean(document.querySelector('[data-testid="ui-base-virtual-keyboard"]')),
    keyboardTitle: document.querySelector('[data-testid="ui-base-virtual-keyboard:title"]')?.textContent ?? null,
})`)

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. Actual=${JSON.stringify(actual)}`)
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
    const session = `input-runtime-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)

        expectState(await readState(session), {
            pageReady: true,
            systemValue: 'system-default',
            pinValue: 'empty',
            amountValue: '12',
            activationValue: 'empty',
            keyboardVisible: false,
        }, 'boot')

        await clickTestId(session, 'ui-base-input-runtime-expo:pin')
        expectState(await readState(session), {
            keyboardVisible: true,
            keyboardTitle: 'PIN 键盘',
        }, 'pin open')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:1')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:2')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:backspace')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')
        expectState(await readState(session), {
            pinValue: '1',
            keyboardVisible: false,
        }, 'pin input')

        await clickTestId(session, 'ui-base-input-runtime-expo:amount')
        expectState(await readState(session), {
            keyboardVisible: true,
            keyboardTitle: '金额键盘',
        }, 'amount open')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:.')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:5')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')
        expectState(await readState(session), {
            amountValue: '12.5',
            keyboardVisible: false,
        }, 'amount input')

        await clickTestId(session, 'ui-base-input-runtime-expo:activation')
        expectState(await readState(session), {
            keyboardVisible: true,
            keyboardTitle: '激活码键盘',
        }, 'activation open')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:A')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:1')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:B')
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')
        expectState(await readState(session), {
            activationValue: 'A1B',
            keyboardVisible: false,
        }, 'activation input')

        if (finalPauseMs > 0) {
            await delay(finalPauseMs)
        }

        console.log(`input-runtime test-expo automation passed on ${baseUrl}`)
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
