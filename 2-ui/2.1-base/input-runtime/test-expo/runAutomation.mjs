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
const preferredPort = Number(process.env.INPUT_RUNTIME_EXPO_PORT ?? '8092')
const headed = process.env.INPUT_RUNTIME_EXPO_HEADED === '1'
const slowMs = Number(process.env.INPUT_RUNTIME_EXPO_SLOW_MS ?? '0')
const finalPauseMs = Number(process.env.INPUT_RUNTIME_EXPO_FINAL_PAUSE_MS ?? '0')

const {runAgent, callAutomation} = createCommandRunner({repoRoot, headed})

const waitForPageReady = async session => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID: 'ui-base-input-runtime-expo:system-text',
    })
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
        pageReady: hasNode(nodeMap, 'ui-base-input-runtime-expo:system-text'),
        systemValue: readText(nodeMap, 'ui-base-input-runtime-expo:system-text:value'),
        pinValue: readText(nodeMap, 'ui-base-input-runtime-expo:pin:value'),
        amountValue: readText(nodeMap, 'ui-base-input-runtime-expo:amount:value'),
        activationValue: readText(nodeMap, 'ui-base-input-runtime-expo:activation:value'),
        keyboardVisible: hasNode(nodeMap, 'ui-base-virtual-keyboard'),
        keyboardTitle: readText(nodeMap, 'ui-base-virtual-keyboard:title'),
    }
}

const expectState = (actual, expected, label) => {
    for (const [key, value] of Object.entries(expected)) {
        if (actual[key] !== value) {
            throw new Error(`${label}: expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}. Actual=${JSON.stringify(actual)}`)
        }
    }
}

const main = async () => {
    await runAgent(['skills', 'get', 'agent-browser'])
    const expo = await startExpoWithRetry({
        startPort: preferredPort,
        packageDir,
        expoCli,
    })
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
        await expo.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
