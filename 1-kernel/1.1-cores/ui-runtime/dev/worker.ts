import fs from 'node:fs/promises'
import path from 'node:path'
import {
    type RootState,
} from '@impos2/kernel-core-base'
import {
    kernelCoreInterconnectionState,
    ServerConnectionStatus,
} from '@impos2/kernel-core-interconnection'
import {
    kernelCoreUiRuntimeCommands,
    selectCurrentScreen,
    selectUiVariable,
} from '../src'
import {
    assert,
    branchRootScreen,
    createApp,
    getInstanceInfo,
    modalScreen,
    primaryRootScreen,
    setFastInterconnectionParameters,
    wait,
} from './shared'

type WorkerRole = 'master' | 'slave'

interface WorkerConfig {
    role: WorkerRole
    resultFile: string
}

async function waitFor<T>(label: string, getter: () => T | undefined, timeoutMs = 8_000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
        const value = getter()
        if (value !== undefined) return value
        await wait(50)
    }
    throw new Error(`timeout waiting for ${label}`)
}

async function writeResult(resultFile: string, payload: Record<string, any>) {
    await fs.mkdir(path.dirname(resultFile), {recursive: true})
    await fs.writeFile(resultFile, JSON.stringify(payload, null, 2), 'utf-8')
}

async function runMaster(resultFile: string) {
    const {store, persistor} = await createApp({
        deviceId: 'ui-runtime-dual',
        displayCount: 2,
        displayIndex: 0,
    })

    await setFastInterconnectionParameters()

    const connectedState = await waitFor('master server connected', () => {
        const state = store.getState() as RootState
        const interconnection = (state as any)[kernelCoreInterconnectionState.instanceInterconnection]
        return interconnection?.serverConnectionStatus === ServerConnectionStatus.CONNECTED ? interconnection : undefined
    })

    await waitFor('master sees slave connected', () => {
        const state = store.getState() as RootState
        const interconnection = (state as any)[kernelCoreInterconnectionState.instanceInterconnection]
        return interconnection?.master?.slaveConnection?.deviceId ? interconnection : undefined
    }, 12_000)

    kernelCoreUiRuntimeCommands.showScreen({
        target: {
            partKey: primaryRootScreen.partKey,
            name: primaryRootScreen.name,
            title: primaryRootScreen.title,
            description: primaryRootScreen.description,
            containerKey: primaryRootScreen.containerKey,
        },
        source: 'master-process',
    }).executeInternally()

    kernelCoreUiRuntimeCommands.setUiVariables({
        'shared.orderNo': 'A1001',
        'shared.amount': 128,
    }).executeInternally()

    kernelCoreUiRuntimeCommands.openOverlay({
        overlay: {
            id: 'dual-payment-modal',
            partKey: modalScreen.partKey,
            name: modalScreen.name,
            title: modalScreen.title,
            description: modalScreen.description,
            props: {amount: 128},
        }
    }).executeInternally()

    await wait(500)

    const state = store.getState() as RootState
    const info = getInstanceInfo(state)
    const interconnection = (state as any)[kernelCoreInterconnectionState.instanceInterconnection]

    await writeResult(resultFile, {
        role: 'master',
        workspace: info.workspace,
        displayMode: info.displayMode,
        serverConnectionStatus: connectedState.serverConnectionStatus,
        slaveConnected: !!interconnection?.master?.slaveConnection?.deviceId,
        currentScreen: selectCurrentScreen(state, 'primary.root.container'),
        orderNo: selectUiVariable(state, 'shared.orderNo', ''),
        amount: selectUiVariable(state, 'shared.amount', 0),
    })

    await persistor.flush()
    await persistor.pause()
}

async function runSlave(resultFile: string) {
    const {store, persistor} = await createApp({
        deviceId: 'ui-runtime-dual',
        displayCount: 2,
        displayIndex: 1,
    })

    await setFastInterconnectionParameters()

    const connectedState = await waitFor('slave server connected', () => {
        const state = store.getState() as RootState
        const interconnection = (state as any)[kernelCoreInterconnectionState.instanceInterconnection]
        return interconnection?.serverConnectionStatus === ServerConnectionStatus.CONNECTED ? interconnection : undefined
    }, 12_000)

    const syncedOrderNo = await waitFor('synced ui variable', () => {
        const state = store.getState() as RootState
        const value = selectUiVariable(state, 'shared.orderNo', '')
        return value ? value : undefined
    }, 12_000)

    await wait(400)

    const state = store.getState() as RootState
    const info = getInstanceInfo(state)
    const rawBranchScreen = selectCurrentScreen(state, 'primary.root.container')
    const slaveStatus = (state as any)[kernelCoreInterconnectionState.slaveStatus]

    assert(info.workspace === 'main', 'slave secondary display should stay in main workspace')

    await writeResult(resultFile, {
        role: 'slave',
        workspace: info.workspace,
        displayMode: info.displayMode,
        serverConnectionStatus: connectedState.serverConnectionStatus,
        syncedOrderNo,
        syncedAmount: selectUiVariable(state, 'shared.amount', 0),
        syncedScreen: rawBranchScreen,
        slaveStatus,
    })

    await persistor.flush()
    await persistor.pause()
}

async function main() {
    const raw = process.argv[2]
    assert(raw, 'worker config path is required')
    const config = JSON.parse(await fs.readFile(raw, 'utf-8')) as WorkerConfig

    if (config.role === 'master') {
        await runMaster(config.resultFile)
        return
    }
    if (config.role === 'slave') {
        await runSlave(config.resultFile)
        return
    }
    throw new Error(`unsupported role: ${(config as any).role}`)
}

main().catch(async error => {
    const raw = process.argv[2]
    if (raw) {
        const config = JSON.parse(await fs.readFile(raw, 'utf-8')) as WorkerConfig
        await writeResult(config.resultFile, {
            role: config.role,
            error: error instanceof Error ? error.message : String(error),
        })
    }
    console.error('[ui-runtime/dev/worker] failed:', error)
    process.exitCode = 1
})
