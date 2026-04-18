import {execFile} from 'node:child_process'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const tsxCli = resolve(repoRoot, 'node_modules/.bin/tsx')
const artifactsDir = resolve('/tmp', 'runtime-react-expo')
const preferredPort = Number(process.env.RUNTIME_REACT_EXPO_PORT ?? '8091')
const runMode = process.env.RUNTIME_REACT_EXPO_MODE ?? 'full'
const headed = process.env.RUNTIME_REACT_EXPO_HEADED === '1'
const slowMs = Number(process.env.RUNTIME_REACT_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.RUNTIME_REACT_EXPO_FINAL_PAUSE_MS ?? '0')

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

const runBash = async (script, options = {}) => run('bash', ['-lc', script], options)

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

const callAutomation = async (session, method, params = {}) => await evalInBrowser(
    session,
    `(() => {
        const automation = globalThis.__IMPOS_AUTOMATION__;
        if (!automation?.started) {
            throw new Error('Browser automation host is not started');
        }
        const request = JSON.stringify({
            jsonrpc: '2.0',
            id: 'runtime-react-expo',
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
    let lastError
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url)
            if (response.ok) {
                return
            }
        } catch (error) {
            lastError = error
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`)
}

const waitForExpoReady = async (logs, port, timeoutMs = 30000) => {
    const waitingMarker = `Waiting on http://localhost:${port}`
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const combined = logs.join('')
        if (combined.includes(waitingMarker)) {
            return
        }
        if (combined.includes('Use port') || combined.includes('Skipping dev server')) {
            throw new Error(`Expo failed to bind port ${port}: ${combined}`)
        }
        await delay(250)
    }
    throw new Error(`Timed out waiting for Expo readiness on ${port}: ${logs.join('')}`)
}

const listListeningPids = async (port) => {
    try {
        const {stdout} = await runBash(`lsof -tiTCP:${port} -sTCP:LISTEN || true`)
        return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => Number(line))
            .filter(pid => Number.isInteger(pid))
    } catch {
        return []
    }
}

const waitForPageReady = async (session) => {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        const ready = await callAutomation(session, 'ui.getNode', {
            target: 'primary',
            nodeId: 'ui-base-runtime-react-test:home',
        })
        if (ready) {
            return
        }
        await delay(500)
    }
    throw new Error(`Timed out waiting for runtime-react Expo page in ${session}`)
}

const readNodeText = async (session, nodeId) => {
    const node = await callAutomation(session, 'ui.getNode', {
        target: 'primary',
        nodeId,
    })
    return node?.text ?? null
}

const hasNode = async (session, nodeId) => {
    const node = await callAutomation(session, 'ui.getNode', {
        target: 'primary',
        nodeId,
    })
    return Boolean(node)
}

const readState = async (session) => ({
    appReady: (await hasNode(session, 'ui-base-runtime-react-test:home'))
        || (await hasNode(session, 'ui-base-runtime-react-test:detail')),
    primary: await readNodeText(session, 'ui-base-runtime-react-test:state:primary'),
    secondary: await readNodeText(session, 'ui-base-runtime-react-test:state:secondary'),
    overlayCount: await readNodeText(session, 'ui-base-runtime-react-test:state:overlay-count'),
    displayMode: await readNodeText(session, 'ui-base-runtime-react-test:state:display-mode'),
    instanceMode: await readNodeText(session, 'ui-base-runtime-react-test:state:instance-mode'),
    workspace: await readNodeText(session, 'ui-base-runtime-react-test:state:workspace'),
    serverConnected: await readNodeText(session, 'ui-base-runtime-react-test:state:server-connected'),
    serverConnectionStatus: await readNodeText(session, 'ui-base-runtime-react-test:state:server-connection-status'),
    connectionError: await readNodeText(session, 'ui-base-runtime-react-test:state:connection-error'),
    peerNodeId: await readNodeText(session, 'ui-base-runtime-react-test:state:peer-node-id'),
    topologyStartError: await readNodeText(session, 'ui-base-runtime-react-test:topology-start-error'),
    topologyStartStatus: await readNodeText(session, 'ui-base-runtime-react-test:topology-start-status'),
    stateVariable: await readNodeText(session, 'ui-base-runtime-react-test:state:variable'),
    homeLabel: await readNodeText(session, 'ui-base-runtime-react-test:home-label'),
    screenVariable: await readNodeText(session, 'ui-base-runtime-react-test:variable-value'),
    detailLabel: await readNodeText(session, 'ui-base-runtime-react-test:detail-label'),
    modalLabel: await readNodeText(session, 'ui-base-runtime-react-test:modal-label'),
    hasHome: await hasNode(session, 'ui-base-runtime-react-test:home'),
    hasDetail: await hasNode(session, 'ui-base-runtime-react-test:detail'),
    hasModal: await hasNode(session, 'ui-base-runtime-react-test:modal'),
    hasSecondary: await hasNode(session, 'ui-base-runtime-react-test:secondary'),
    hasExpoError: await hasNode(session, 'ui-base-runtime-react-test:expo-error-message'),
})

const assertNoRequireCycle = async (session, label) => {
    const consoleText = await runAgent(['--session', session, 'console'])
    if (consoleText.includes('Require cycle')) {
        throw new Error(`${label}: unexpected require cycle warning in browser console:\n${consoleText}`)
    }
}

const clickTestId = async (session, testId) => {
    await callAutomation(session, 'ui.performAction', {
        target: 'primary',
        nodeId: testId,
        action: 'press',
    })
    await callAutomation(session, 'wait.forIdle', {
        target: 'primary',
        timeoutMs: 3_000,
    })
    await delay(Math.max(500, slowMs))
}

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. Actual: ${JSON.stringify(actual)}`)
        }
    }
}

const openScenario = async (baseUrl, name) => {
    const session = `runtime-react-expo-${process.pid}-${name}`
    await runAgent(['--session', session, 'open', `${baseUrl}?displayCount=2&displayIndex=0&topology=dual`])
    await waitForPageReady(session)
    await assertNoRequireCycle(session, `${name}: boot`)
    const state = await readState(session)
    expectState(state, {
        appReady: true,
        primary: 'ui.base.runtime-react.test.home',
        secondary: 'ui.base.runtime-react.test.secondary',
        overlayCount: '0',
        displayMode: 'PRIMARY',
        instanceMode: 'MASTER',
        workspace: 'MAIN',
        stateVariable: 'bootstrapped',
        homeLabel: 'home-initial',
        screenVariable: 'bootstrapped',
        hasHome: true,
        hasSecondary: true,
        hasExpoError: false,
    }, `${name}: boot`)
    return session
}

const openDisplayPage = async (baseUrl, input) => {
    const session = `runtime-react-expo-${process.pid}-${input.name}`
    await runAgent([
        '--session',
        session,
        'open',
        `${baseUrl}?displayCount=2&displayIndex=${input.displayIndex}&topology=dual&deviceId=runtime-react-dual-page-test`,
    ])
    await waitForPageReady(session)
    await assertNoRequireCycle(session, `${input.name}: boot`)
    const state = await readState(session)
    expectState(state, {
        appReady: true,
        displayMode: input.expectedDisplayMode,
        instanceMode: input.expectedInstanceMode,
        workspace: input.expectedWorkspace,
        primary: 'ui.base.runtime-react.test.home',
        secondary: 'ui.base.runtime-react.test.secondary',
        hasHome: true,
        hasSecondary: true,
        hasExpoError: false,
    }, `${input.name}: display context`)
    return session
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
    const consoleText = await runAgent(['--session', session, 'console']).catch(() => '')
    throw new Error(`Timed out waiting for ${label}. lastState=${JSON.stringify(lastState)} console=${consoleText}`)
}

const createTopologyHost = async () => {
    const scriptPath = resolve(packageDir, 'test-expo/startTopologyHost.ts')
    const child = spawn(tsxCli, [scriptPath], {
        cwd: repoRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const addressInfo = await new Promise((resolvePromise, reject) => {
        const timeout = setTimeout(() => {
            settled = true
            reject(new Error(`Timed out starting topology host. stderr=${stderr}`))
        }, 30000)

        child.stdout.on('data', chunk => {
            stdout += chunk.toString()
            const line = stdout
                .split('\n')
                .map(entry => entry.trim())
                .find(entry => entry.includes('"addressInfo"'))
            if (!line || settled) {
                return
            }
            try {
                const parsed = JSON.parse(line)
                if (!parsed?.addressInfo) {
                    return
                }
                settled = true
                clearTimeout(timeout)
                resolvePromise(parsed.addressInfo)
            } catch {
                // Keep buffering until full JSON line arrives.
            }
        })
        child.stderr.on('data', chunk => {
            stderr += chunk.toString()
        })
        child.once('exit', code => {
            if (settled) {
                return
            }
            settled = true
            clearTimeout(timeout)
            reject(new Error(`Topology host exited before ready with code ${code}. stderr=${stderr}`))
        })
    })

    return {
        addressInfo,
        async issueTicket(masterNodeId) {
            const response = await fetch(`${addressInfo.httpBaseUrl}/tickets`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    masterNodeId,
                }),
            })
            if (!response.ok) {
                throw new Error(`Failed to issue topology ticket: HTTP ${response.status}`)
            }
            return await response.json()
        },
        async getStats() {
            const response = await fetch(`${addressInfo.httpBaseUrl}/stats`)
            if (!response.ok) {
                throw new Error(`Failed to read topology stats: HTTP ${response.status}`)
            }
            return await response.json()
        },
        getLogs() {
            return {
                stdout,
                stderr,
            }
        },
        async close() {
            child.kill('SIGTERM')
            await delay(500)
            if (!child.killed) {
                child.kill('SIGKILL')
            }
        },
    }
}

const openTopologyHostPage = async (baseUrl, input) => {
    const session = `runtime-react-expo-${process.pid}-${input.name}`
    const params = new URLSearchParams({
        displayCount: '2',
        displayIndex: String(input.displayIndex),
        topology: 'host',
        topologyRole: input.topologyRole,
        topologyHostBaseUrl: input.hostBaseUrl,
        topologyWsUrl: input.wsUrl,
        topologyTicketToken: input.ticketToken,
        topologyProfileName: 'runtime-react.expo.topology-host',
        deviceId: input.deviceId,
        topologyNodeId: input.nodeId,
    })
    await runAgent(['--session', session, 'open', `${baseUrl}?${params.toString()}`])
    await waitForPageReady(session)
    await assertNoRequireCycle(session, `${input.name}: topology boot`)
    return session
}

const closeSession = async (session) => {
    try {
        await runAgent(['--session', session, 'close'])
    } catch {
        // Best-effort cleanup only.
    }
}

const runScenario = async (baseUrl, name, test) => {
    const session = await openScenario(baseUrl, name)
    try {
        await test(session)
    } finally {
        await closeSession(session)
    }
}

const runCommandFlowScenarios = async (baseUrl) => {
    await runScenario(baseUrl, 'navigate', async (session) => {
        await clickTestId(session, 'ui-base-runtime-react-test:navigate-detail')
        expectState(await readState(session), {
            primary: 'ui.base.runtime-react.test.detail',
            detailLabel: 'detail-from-navigate',
            hasDetail: true,
            hasExpoError: false,
        }, 'navigate')
    })

    await runScenario(baseUrl, 'replace', async (session) => {
        await clickTestId(session, 'ui-base-runtime-react-test:replace-detail')
        expectState(await readState(session), {
            primary: 'ui.base.runtime-react.test.detail',
            detailLabel: 'detail-from-replace',
            hasDetail: true,
            hasExpoError: false,
        }, 'replace')
    })

    await runScenario(baseUrl, 'variable', async (session) => {
        await clickTestId(session, 'ui-base-runtime-react-test:set-variable')
        expectState(await readState(session), {
            stateVariable: 'value-from-button',
            screenVariable: 'value-from-button',
            hasExpoError: false,
        }, 'variable')
    })

    await runScenario(baseUrl, 'modal', async (session) => {
        await clickTestId(session, 'ui-base-runtime-react-test:open-modal')
        expectState(await readState(session), {
            overlayCount: '1',
            modalLabel: 'modal-opened',
            hasModal: true,
            hasExpoError: false,
        }, 'modal open')
        await clickTestId(session, 'ui-base-runtime-react-test:close-modal')
        expectState(await readState(session), {
            overlayCount: '0',
            hasModal: false,
            hasExpoError: false,
        }, 'modal close')
    })

    await runScenario(baseUrl, 'display-mode', async (session) => {
        await clickTestId(session, 'ui-base-runtime-react-test:secondary-display')
        expectState(await readState(session), {
            displayMode: 'SECONDARY',
            hasSecondary: true,
            hasExpoError: false,
        }, 'display mode')
    })
}

const runDualPageDisplayContextSmoke = async (baseUrl) => {
    const sessions = []
    try {
        sessions.push(await openDisplayPage(baseUrl, {
            name: 'dual-page-primary',
            displayIndex: 0,
            expectedDisplayMode: 'PRIMARY',
            expectedInstanceMode: 'MASTER',
            expectedWorkspace: 'MAIN',
        }))
        sessions.push(await openDisplayPage(baseUrl, {
            name: 'dual-page-secondary',
            displayIndex: 1,
            expectedDisplayMode: 'SECONDARY',
            expectedInstanceMode: 'SLAVE',
            expectedWorkspace: 'MAIN',
        }))
        await delay(Math.max(finalPauseMs, slowMs))
    } finally {
        await Promise.all(sessions.map(closeSession))
    }
}

const runDualPageTopologyHostScenario = async (baseUrl) => {
    const topologyHost = await createTopologyHost()
    const sessions = []
    try {
        const masterNodeId = `runtime-react-topology-master-${process.pid}`
        const ticket = await topologyHost.issueTicket(masterNodeId)
        if (!ticket?.token) {
            throw new Error(`Topology ticket token missing: ${JSON.stringify(ticket)}`)
        }

        sessions.push(await openTopologyHostPage(baseUrl, {
            name: 'topology-host-master',
            displayIndex: 0,
            topologyRole: 'master',
            hostBaseUrl: topologyHost.addressInfo.httpBaseUrl,
            wsUrl: topologyHost.addressInfo.wsUrl,
            ticketToken: ticket.token,
            deviceId: 'runtime-react-topology-device',
            nodeId: masterNodeId,
        }))
        const slaveNodeId = `runtime-react-topology-slave-${process.pid}`
        sessions.push(await openTopologyHostPage(baseUrl, {
            name: 'topology-host-slave',
            displayIndex: 1,
            topologyRole: 'slave',
            hostBaseUrl: topologyHost.addressInfo.httpBaseUrl,
            wsUrl: topologyHost.addressInfo.wsUrl,
            ticketToken: ticket.token,
            deviceId: 'runtime-react-topology-device',
            nodeId: slaveNodeId,
        }))

        const masterState = await waitForState(
            sessions[0],
            state => state.serverConnectionStatus === 'CONNECTED' && state.peerNodeId && state.peerNodeId !== 'null',
            'master topology connection',
        )
        const slaveState = await waitForState(
            sessions[1],
            state => state.serverConnectionStatus === 'CONNECTED' && state.peerNodeId && state.peerNodeId !== 'null',
            'slave topology connection',
        )

        expectState(masterState, {
            appReady: true,
            displayMode: 'PRIMARY',
            instanceMode: 'MASTER',
            workspace: 'MAIN',
            serverConnected: 'true',
            serverConnectionStatus: 'CONNECTED',
            hasExpoError: false,
        }, 'topology-host master')
        expectState(slaveState, {
            appReady: true,
            displayMode: 'SECONDARY',
            instanceMode: 'SLAVE',
            workspace: 'MAIN',
            serverConnected: 'true',
            serverConnectionStatus: 'CONNECTED',
            hasExpoError: false,
        }, 'topology-host slave')
    } catch (error) {
        const stats = await topologyHost.getStats().catch(statsError => ({
            statsError: statsError instanceof Error ? statsError.message : String(statsError),
        }))
        const logs = topologyHost.getLogs()
        throw new Error(`${error instanceof Error ? error.message : String(error)} hostStats=${JSON.stringify(stats)} hostLogs=${JSON.stringify(logs)}`)
    } finally {
        await Promise.all(sessions.map(closeSession))
        await topologyHost.close()
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
        logs,
        port,
        async stop() {
            try {
                process.kill(server.pid, 'SIGTERM')
            } catch {
                try {
                    server.kill('SIGTERM')
                } catch {
                    // Best-effort cleanup only.
                }
            }
            await delay(1000)
            const lingering = await listListeningPids(port)
            for (const pid of lingering) {
                try {
                    process.kill(pid, 'SIGTERM')
                } catch {
                    // Best-effort cleanup only.
                }
            }
            await delay(500)
            const stubborn = await listListeningPids(port)
            for (const pid of stubborn) {
                try {
                    process.kill(pid, 'SIGKILL')
                } catch {
                    // Best-effort cleanup only.
                }
            }
            await writeFile(resolve(artifactsDir, 'runtime-react-expo-server.log'), logs.join(''))
        },
    }
}

const startExpoWithRetry = async (startPort, attempts = 5) => {
    let port = startPort
    let lastError
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const freePort = await findFreePort(port)
            return await startExpo(freePort)
        } catch (error) {
            lastError = error
            const message = error instanceof Error ? error.message : String(error)
            if (!message.includes('EADDRINUSE') && !message.includes('Port') && !message.includes('busy')) {
                throw error
            }
            port += 1
        }
    }
    throw lastError ?? new Error(`Unable to start Expo after ${attempts} attempts`)
}

const main = async () => {
    await mkdir(artifactsDir, {recursive: true})
    await runAgent(['skills', 'get', 'agent-browser'])

    const expo = await startExpoWithRetry(preferredPort)
    const baseUrl = `http://localhost:${expo.port}`

    try {
        if (runMode === 'dual-pages') {
            await runDualPageDisplayContextSmoke(baseUrl)
        } else if (runMode === 'topology-host') {
            await runDualPageTopologyHostScenario(baseUrl)
        } else {
            await runCommandFlowScenarios(baseUrl)
            await runDualPageDisplayContextSmoke(baseUrl)
            await runDualPageTopologyHostScenario(baseUrl)
        }

        if (finalPauseMs > 0 && runMode !== 'dual-pages') {
            await delay(finalPauseMs)
        }

        console.log(`runtime-react test-expo automation passed on ${baseUrl} (${runMode}, headed=${headed})`)
    } finally {
        await expo.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
