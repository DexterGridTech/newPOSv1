import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {
    createCommandRunner,
    startExpoWithRetry,
    waitForAutomationNode,
    readAutomationTree,
    toAutomationNodeMap,
} from './browserAutomationHarness.mjs'

const testExpoDir = dirname(fileURLToPath(import.meta.url))
const packageDir = resolve(testExpoDir, '..')
const repoRoot = resolve(packageDir, '../../..')
const expoCli = resolve(repoRoot, 'node_modules/expo/bin/cli')
const preferredPort = Number(process.env.UI_AUTOMATION_RUNTIME_EXPO_PORT ?? '8096')
const headed = process.env.UI_AUTOMATION_RUNTIME_EXPO_HEADED === '1'
const finalPauseMs = Number(process.env.UI_AUTOMATION_RUNTIME_EXPO_FINAL_PAUSE_MS ?? '0')

const {runAgent, callAutomation} = createCommandRunner({repoRoot, headed})

const waitForPageReady = async session => {
    await waitForAutomationNode({
        callAutomation,
        session,
        testID: 'ui-base-automation-runtime-expo:ready',
    })
}

const readState = async session => {
    const nodes = await readAutomationTree({callAutomation, session})
    const nodeMap = toAutomationNodeMap(nodes)
    return {
        protocol: nodeMap.get('ui-base-automation-runtime-expo:protocol')?.text ?? null,
        host: nodeMap.get('ui-base-automation-runtime-expo:host')?.text ?? null,
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
    const session = `ui-automation-runtime-expo-${process.pid}`

    try {
        await runAgent(['--session', session, 'open', baseUrl])
        await waitForPageReady(session)

        const state = await readState(session)
        if (state.protocol !== '1') {
            throw new Error(`Expected protocol=1, got ${JSON.stringify(state)}`)
        }
        if (state.host !== 'true') {
            throw new Error(`Expected host=true, got ${JSON.stringify(state)}`)
        }

        if (finalPauseMs > 0) {
            await delay(finalPauseMs)
        }

        console.log(`ui-automation-runtime test-expo automation passed on ${baseUrl}`)
    } finally {
        await expo.stop()
    }
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
