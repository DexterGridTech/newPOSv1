import {execFile, spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {setTimeout as delay} from 'node:timers/promises'

const parseEvalResult = stdout => {
    const value = JSON.parse(stdout.trim())
    return typeof value === 'string' ? JSON.parse(value) : value
}

export const createCommandRunner = ({
    repoRoot,
    headed = false,
}) => {
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

    const evalInBrowser = async (session, expression) => {
        const stdout = await runAgent(['--session', session, 'eval', expression])
        return parseEvalResult(stdout)
    }

    const callAutomation = async (session, method, params = {}) => await evalInBrowser(
        session,
        `(() => {
            const automation = globalThis.__IMPOS_AUTOMATION__;
            if (!automation?.started) {
                throw new Error('Browser automation host is not started');
            }
            const request = JSON.stringify({
                jsonrpc: '2.0',
                id: 'expo-browser-automation',
                method: ${JSON.stringify(method)},
                params: ${JSON.stringify(params)},
            });
            return automation.dispatchMessage(request).then(message => {
                const response = JSON.parse(message);
                if (response.error) {
                    throw new Error(response.error.message ?? 'AUTOMATION_ERROR');
                }
                return JSON.stringify(response.result ?? null);
            });
        })()`,
    )

    return {
        run,
        runAgent,
        evalInBrowser,
        callAutomation,
    }
}

export const findFreePort = async startPort => {
    for (let port = startPort; port < startPort + 50; port += 1) {
        const available = await new Promise(resolvePromise => {
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

export const waitForHttp = async (url, timeoutMs = 30000) => {
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

export const waitForExpoReady = async (logs, port, timeoutMs = 30000) => {
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

export const startExpo = async ({
    packageDir,
    expoCli,
    port,
    env = {},
}) => {
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
            ...env,
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

export const startExpoWithRetry = async ({
    startPort,
    attempts = 5,
    packageDir,
    expoCli,
    env = {},
}) => {
    let port = startPort
    let lastError
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await startExpo({
                packageDir,
                expoCli,
                port: await findFreePort(port),
                env,
            })
        } catch (error) {
            lastError = error
            port += 1
        }
    }
    throw lastError ?? new Error(`Unable to start Expo after ${attempts} attempts`)
}

export const waitForAutomationNode = async ({
    callAutomation,
    session,
    testID,
    target = 'primary',
    timeoutMs = 30000,
}) => {
    const deadline = Date.now() + timeoutMs
    let lastError
    while (Date.now() < deadline) {
        try {
            const node = await callAutomation(session, 'wait.forNode', {
                target,
                testID,
                timeoutMs: 500,
            })
            if (node) {
                return node
            }
        } catch (error) {
            lastError = error
        }
        await delay(250)
    }
    throw new Error(`Timed out waiting for automation node ${testID}: ${lastError?.message ?? 'no node'}`)
}

export const readAutomationTree = async ({
    callAutomation,
    session,
    target = 'primary',
}) => await callAutomation(session, 'ui.getTree', {target})

export const toAutomationNodeMap = nodes => new Map(
    (Array.isArray(nodes) ? nodes : []).map(node => [node.nodeId, node]),
)

export const pressAutomationNode = async ({
    callAutomation,
    session,
    nodeId,
    target = 'primary',
    slowMs = 0,
}) => {
    await callAutomation(session, 'ui.performAction', {
        target,
        nodeId,
        action: 'press',
    })
    await callAutomation(session, 'wait.forIdle', {
        target,
        timeoutMs: 3000,
    })
    await delay(Math.max(0, slowMs))
}

export const rapidPressAutomationNode = async ({
    callAutomation,
    session,
    nodeId,
    times,
    target = 'primary',
}) => {
    for (let index = 0; index < times; index += 1) {
        await callAutomation(session, 'ui.performAction', {
            target,
            nodeId,
            action: 'press',
        })
    }
    await callAutomation(session, 'wait.forIdle', {
        target,
        timeoutMs: 3000,
    })
}
