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
} from '../../ui-automation-runtime/test-expo/browserAutomationHarness.mjs'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.TERMINAL_CONSOLE_EXPO_PORT ?? '8094')
const headed = process.env.TERMINAL_CONSOLE_EXPO_HEADED === '1'
const slowMs = Number(process.env.TERMINAL_CONSOLE_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.TERMINAL_CONSOLE_EXPO_FINAL_PAUSE_MS ?? '0')

const {runAgent, callAutomation} = createCommandRunner({repoRoot, headed})

const waitForPageReady = async session => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID: 'ui-base-terminal-console-expo:ready',
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

const readText = (nodeMap, nodeId) => nodeMap.get(nodeId)?.text ?? null
const hasNode = (nodeMap, nodeId) => nodeMap.has(nodeId)

const readState = async session => {
    const nodes = await readAutomationTree({callAutomation, session})
    const nodeMap = toAutomationNodeMap(nodes)
    return {
        ready: hasNode(nodeMap, 'ui-base-terminal-console-expo:ready'),
        activationCode: readText(nodeMap, 'ui-base-terminal-console-expo:activation-code'),
        activationStatus: readText(nodeMap, 'ui-base-terminal-console-expo:activation-status'),
        activationInputValue: readText(nodeMap, 'ui-base-terminal-activate-device:value'),
        activationMessage: readText(nodeMap, 'ui-base-terminal-activate-device:message'),
        summaryDescription: readText(nodeMap, 'ui-base-terminal-summary:description'),
        keyboardVisible: hasNode(nodeMap, 'ui-base-virtual-keyboard'),
        keyboardTitle: readText(nodeMap, 'ui-base-virtual-keyboard:title'),
    }
}

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. actual=${JSON.stringify(actual)}`)
        }
    }
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
    const session = `terminal-console-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)
        await assertRuntimeLogsPresent(session, [
            'kernel-runtime-app-v2-created',
            'ui-base-runtime-react-install',
            'kernel-base-tcp-control-runtime-v2-install',
            'ui-base-terminal-console-install',
        ], 'boot logs')

        const initial = await readState(session)
        expectState(initial, {
            ready: true,
            activationStatus: 'UNACTIVATED',
            keyboardVisible: false,
        }, 'boot')
        if (!initial.activationCode) {
            throw new Error(`missing activation code from expo shell: ${JSON.stringify(initial)}`)
        }

        await clickTestId(session, 'ui-base-terminal-activate-device:input')
        expectState(await readState(session), {
            keyboardVisible: true,
            keyboardTitle: '激活码键盘',
        }, 'activation keyboard open')

        for (const key of initial.activationCode.split('')) {
            await clickTestId(session, `ui-base-virtual-keyboard:key:${key}`)
        }
        await clickTestId(session, 'ui-base-virtual-keyboard:key:enter')

        const filled = await readState(session)
        expectState(filled, {
            keyboardVisible: false,
        }, 'activation keyboard closed')
        if (!filled.activationInputValue?.includes(initial.activationCode)) {
            throw new Error(`activation input did not reflect code: ${JSON.stringify(filled)}`)
        }

        await clickTestId(session, 'ui-base-terminal-activate-device:submit')

        const deadline = Date.now() + 30000
        let finalState = await readState(session)
        while (Date.now() < deadline && finalState.activationStatus !== 'ACTIVATED') {
            await delay(1000)
            finalState = await readState(session)
        }
        expectState(finalState, {
            activationStatus: 'ACTIVATED',
        }, 'after activation')
        if (!finalState.summaryDescription?.includes('终端已完成激活')) {
            throw new Error(`summary did not update after activation: ${JSON.stringify(finalState)}`)
        }

        if (finalPauseMs > 0) {
            await delay(finalPauseMs)
        }

        console.log(`terminal-console test-expo automation passed on ${baseUrl} -> ${mockPlatform.baseUrl}`)
    } finally {
        await expo.stop()
        await mockPlatform.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
