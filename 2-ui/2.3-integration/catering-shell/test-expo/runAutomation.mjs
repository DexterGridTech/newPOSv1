import {spawn} from 'node:child_process'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {
    createCommandRunner,
    startExpoWithRetry,
    waitForAutomationNode,
    readAutomationTree,
    toAutomationNodeMap,
    pressAutomationNode,
    rapidPressAutomationNode,
} from '../../../2.1-base/ui-automation-runtime/test-expo/browserAutomationHarness.mjs'

const adminLauncherRequiredPresses = 5

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.RETAIL_SHELL_EXPO_PORT ?? '8095')
const headed = process.env.RETAIL_SHELL_EXPO_HEADED === '1'
const slowMs = Number(process.env.RETAIL_SHELL_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.RETAIL_SHELL_EXPO_FINAL_PAUSE_MS ?? '0')

const {runAgent, callAutomation} = createCommandRunner({repoRoot, headed})

const waitForPageReady = async session => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID: 'ui-integration-catering-shell-expo:ready',
    })
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
    await pressAutomationNode({
        callAutomation,
        session,
        nodeId: testId,
        slowMs: Math.max(500, slowMs),
    })
}

const rapidClickRootLauncher = async (session, times = adminLauncherRequiredPresses) => {
    await rapidPressAutomationNode({
        callAutomation,
        session,
        nodeId: 'ui-integration-catering-shell:root',
        times,
    })
    await delay(Math.max(200, slowMs))
}

const readText = (nodeMap, nodeId) => nodeMap.get(nodeId)?.text ?? null
const hasNode = (nodeMap, nodeId) => nodeMap.has(nodeId)

const readState = async session => {
    const nodes = await readAutomationTree({callAutomation, session})
    const nodeMap = toAutomationNodeMap(nodes)
    return {
        ready: hasNode(nodeMap, 'ui-integration-catering-shell-expo:ready'),
        activationCode: readText(nodeMap, 'ui-integration-catering-shell-expo:activation-code'),
        activationStatus: readText(nodeMap, 'ui-integration-catering-shell-expo:activation-status'),
        terminalId: readText(nodeMap, 'ui-integration-catering-shell-expo:terminal-id'),
        activationMessage: readText(nodeMap, 'ui-base-terminal-activate-device:message'),
        activationInputValue: readText(nodeMap, 'ui-base-terminal-activate-device:value'),
        welcomeVisible: hasNode(nodeMap, 'ui-integration-catering-shell:welcome'),
        welcomeTerminalId: readText(nodeMap, 'ui-integration-catering-shell:welcome:terminal-id'),
        adminLoginVisible: hasNode(nodeMap, 'ui-base-admin-popup:login'),
        adminPanelVisible: hasNode(nodeMap, 'ui-base-admin-popup:panel'),
        selectedTab: readText(nodeMap, 'ui-base-admin-popup:selected-tab'),
        keyboardVisible: hasNode(nodeMap, 'ui-base-virtual-keyboard'),
        keyboardTitle: readText(nodeMap, 'ui-base-virtual-keyboard:title'),
        adminPassword: readText(nodeMap, 'ui-integration-catering-shell-expo:admin-password'),
    }
}

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

const main = async () => {
    await runAgent(['skills', 'get', 'agent-browser'])
    const mockPlatform = await createMockPlatform()
    const expo = await startExpoWithRetry({
        startPort: preferredPort,
        packageDir,
        expoCli,
        env: {
            EXPO_PUBLIC_MOCK_PLATFORM_BASE_URL: mockPlatform.baseUrl,
        },
    })
    const baseUrl = `http://localhost:${expo.port}`
    const session = `catering-shell-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)
        await assertRuntimeLogsPresent(session, [
            'kernel-runtime-app-v2-created',
            'ui-base-runtime-react-install',
            'kernel-base-tcp-control-runtime-v2-install',
            'ui-base-admin-console-install',
            'ui-base-terminal-console-install',
            'ui-integration-catering-shell-install',
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
            selectedTab: 'terminal',
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

        console.log(`catering-shell test-expo automation passed on ${baseUrl}`)
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
