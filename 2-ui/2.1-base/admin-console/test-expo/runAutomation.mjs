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
} from '../../ui-automation-runtime/test-expo/browserAutomationHarness.mjs'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.ADMIN_CONSOLE_EXPO_PORT ?? '8093')
const headed = process.env.ADMIN_CONSOLE_EXPO_HEADED === '1'
const slowMs = Number(process.env.ADMIN_CONSOLE_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.ADMIN_CONSOLE_EXPO_FINAL_PAUSE_MS ?? '0')
const adminLauncherRequiredPresses = 5

const {runAgent, callAutomation, evalInBrowser} = createCommandRunner({repoRoot, headed})

const waitForPageReady = async session => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID: 'ui-base-admin-console-expo:ready',
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

const assertRuntimeLogsAbsent = async (session, rejectedNeedles, label) => {
    const consoleText = await runAgent(['--session', session, 'console'])
    for (const needle of rejectedNeedles) {
        if (consoleText.includes(needle)) {
            throw new Error(`${label}: unexpected console log "${needle}". console=${consoleText}`)
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

const rapidClickTestId = async (session, testId, times) => {
    await rapidPressAutomationNode({
        callAutomation,
        session,
        nodeId: testId,
        times,
    })
    await delay(Math.max(500, slowMs))
}

const readText = (nodeMap, nodeId) => nodeMap.get(nodeId)?.text ?? null
const hasNode = (nodeMap, nodeId) => nodeMap.has(nodeId)

const waitForTestId = async (session, testID, label) => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID,
        timeoutMs: 5000,
    }).catch(error => {
        throw new Error(`${label}: ${error.message}`)
    })
}

const dumpDebugSnapshot = async (session, label) => {
    const [state, runtimeState, consoleText] = await Promise.allSettled([
        readState(session),
        readRuntimeState(session),
        runAgent(['--session', session, 'console']),
    ])
    console.error(`[admin-console-expo-debug] ${label}`, JSON.stringify({
        state: state.status === 'fulfilled' ? state.value : {error: state.reason?.message},
        runtimeState: runtimeState.status === 'fulfilled' ? runtimeState.value : {error: runtimeState.reason?.message},
        consoleTail: consoleText.status === 'fulfilled'
            ? consoleText.value.split('\n').slice(-80).join('\n')
            : consoleText.reason?.message,
    }, null, 2))
}

const readState = async session => {
    const nodes = await readAutomationTree({callAutomation, session})
    const nodeMap = toAutomationNodeMap(nodes)
    return {
        ready: hasNode(nodeMap, 'ui-base-admin-console-expo:ready'),
        password: readText(nodeMap, 'ui-base-admin-console-expo:password'),
        loginVisible: hasNode(nodeMap, 'ui-base-admin-popup:login'),
        panelVisible: hasNode(nodeMap, 'ui-base-admin-popup:panel'),
        runtimeGroupVisible: hasNode(nodeMap, 'ui-base-admin-popup:group:runtime'),
        adapterGroupVisible: hasNode(nodeMap, 'ui-base-admin-popup:group:adapter'),
        selectedTab: readText(nodeMap, 'ui-base-admin-popup:selected-tab'),
        adapterVisible: hasNode(nodeMap, 'ui-base-admin-adapter-diagnostics'),
        deviceVisible: hasNode(nodeMap, 'ui-base-admin-section:device'),
        logsVisible: hasNode(nodeMap, 'ui-base-admin-section:logs'),
        connectorVisible: hasNode(nodeMap, 'ui-base-admin-section:connector'),
        terminalVisible: hasNode(nodeMap, 'ui-base-admin-section:terminal'),
        topologyVisible: hasNode(nodeMap, 'ui-base-admin-section:topology'),
        loadingVisible: hasNode(nodeMap, 'ui-base-screen-container:primary:loading'),
        keyboardVisible: hasNode(nodeMap, 'ui-base-virtual-keyboard'),
        adapterMessage: readText(nodeMap, 'ui-base-admin-adapter-diagnostics'),
    }
}

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. actual=${JSON.stringify(actual)}`)
        }
    }
}

const readRuntimeState = async session => await evalInBrowser(
    session,
    `(() => {
        const state = globalThis.__ADMIN_CONSOLE_EXPO_HARNESS__?.store?.getState();
        if (!state) {
            throw new Error('admin console harness state unavailable');
        }
        const uiScreen = state['kernel.base.ui-runtime-v2.screen.main']?.['ui.base.admin-console.tab-content.container']?.value ?? null;
        const adminState = state['ui.base.admin-console.console'] ?? null;
        return JSON.stringify({
            uiScreen,
            adminState,
            adminHasSelectedTab: !!adminState && Object.prototype.hasOwnProperty.call(adminState, 'selectedTab'),
        });
    })()`,
)

const main = async () => {
    await runAgent(['skills', 'get', 'agent-browser'])
    const expo = await startExpoWithRetry({
        startPort: preferredPort,
        packageDir,
        expoCli,
    })
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

        await rapidClickTestId(session, 'ui-base-admin-console-expo:launcher', adminLauncherRequiredPresses)

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
        await waitForTestId(session, 'ui-base-admin-section:terminal', 'panel terminal section')
            .catch(async error => {
                await dumpDebugSnapshot(session, 'panel terminal section failed')
                throw error
            })

        expectState(await readState(session), {
            panelVisible: true,
            runtimeGroupVisible: true,
            adapterGroupVisible: true,
            selectedTab: 'terminal',
            terminalVisible: true,
        }, 'panel open')

        await clickTestId(session, 'ui-base-admin-popup:tab:device')
        await waitForTestId(session, 'ui-base-admin-section:device', 'device section')
        expectState(await readState(session), {
            selectedTab: 'device',
            deviceVisible: true,
        }, 'device tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:logs')
        await waitForTestId(session, 'ui-base-admin-section:logs', 'logs section')
        expectState(await readState(session), {
            selectedTab: 'logs',
            logsVisible: true,
        }, 'logs tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:topology')
        await waitForTestId(session, 'ui-base-admin-section:topology', 'topology section')
        expectState(await readState(session), {
            selectedTab: 'topology',
            topologyVisible: true,
        }, 'topology tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:connector')
        await waitForTestId(session, 'ui-base-admin-section:connector', 'connector section')
        expectState(await readState(session), {
            selectedTab: 'connector',
            connectorVisible: true,
        }, 'connector tab')

        await clickTestId(session, 'ui-base-admin-popup:tab:adapter')
        await waitForTestId(session, 'ui-base-admin-adapter-diagnostics', 'adapter section')
        expectState(await readState(session), {
            selectedTab: 'adapter',
            adapterVisible: true,
        }, 'adapter tab')

        await clickTestId(session, 'ui-base-admin-adapter-diagnostics:run-all')
        const afterRun = await readState(session)
        if (!afterRun.adapterMessage?.includes('已完成 2 项测试')) {
            throw new Error(`adapter run result missing: ${JSON.stringify(afterRun)}`)
        }

        await clickTestId(session, 'ui-base-admin-popup:tab:device')
        await waitForTestId(session, 'ui-base-admin-section:device', 'cached device section')
        expectState(await readState(session), {
            selectedTab: 'device',
            deviceVisible: true,
            loadingVisible: false,
        }, 'device cached tab')

        const runtimeState = await readRuntimeState(session)
        expectState(runtimeState, {
            adminHasSelectedTab: false,
        }, 'runtime state selected tab ownership')
        expectState(runtimeState.uiScreen, {
            partKey: 'ui.base.admin-console.tab.device',
        }, 'runtime state current ui screen')
        if (runtimeState.uiScreen?.props?.tab !== 'device') {
            throw new Error(`runtime ui screen tab mismatch: ${JSON.stringify(runtimeState)}`)
        }

        await assertRuntimeLogsAbsent(session, [
            'console.error',
            'console.warn',
            'Unhandled',
            'Error:',
        ], 'browser console errors')

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
