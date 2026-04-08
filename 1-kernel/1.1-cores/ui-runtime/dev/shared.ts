import path from 'node:path'
import {
    type ApplicationConfig,
    ApplicationManager,
    type RootState,
    ScreenMode,
    type ScreenPartRegistration,
    kernelCoreBaseCommands,
} from '@impos2/kernel-core-base'
import {
    DisplayMode,
    kernelCoreInterconnectionParameters,
    kernelCoreInterconnectionState,
} from '@impos2/kernel-core-interconnection'
import {
    type KernelCoreUiRuntimeWorkspaceState,
    kernelCoreUiRuntimeCommands,
    kernelCoreUiRuntimeModule,
    kernelCoreUiRuntimeWorkspaceState,
    selectCurrentOverlays,
    selectCurrentScreen,
    selectUiVariable,
} from '../src'

export const TSX_CLI = require.resolve('tsx/cli')

export const DEV_SERVER_SPACE = {
    selectedSpace: 'dev',
    spaces: [
        {
            name: 'dev',
            serverAddresses: []
        }
    ]
}

export const primaryRootScreen: ScreenPartRegistration = {
    partKey: 'dev.primary.root',
    name: 'PrimaryRoot',
    title: 'PrimaryRoot',
    description: 'Primary root screen',
    containerKey: 'primary.root.container',
    indexInContainer: 0,
    componentType: (() => null) as any,
    screenMode: [ScreenMode.DESKTOP],
    workspace: ['main'],
    instanceMode: ['master'],
}

export const branchRootScreen: ScreenPartRegistration = {
    partKey: 'dev.branch.root',
    name: 'BranchRoot',
    title: 'BranchRoot',
    description: 'Branch root screen',
    containerKey: 'branch.root.container',
    indexInContainer: 0,
    componentType: (() => null) as any,
    screenMode: [ScreenMode.DESKTOP],
    workspace: ['branch'],
    instanceMode: ['slave'],
}

export const modalScreen: ScreenPartRegistration = {
    partKey: 'dev.payment.modal',
    name: 'PaymentModal',
    title: 'PaymentModal',
    description: 'Payment modal',
    componentType: (() => null) as any,
    screenMode: [ScreenMode.DESKTOP],
    workspace: ['main', 'branch'],
    instanceMode: ['master', 'slave'],
}

export function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

export async function createApp(params: {
    deviceId: string
    displayCount: number
    displayIndex: number
}) {
    const appConfig: ApplicationConfig = {
        serverSpace: DEV_SERVER_SPACE,
        environment: {
            deviceId: params.deviceId,
            production: false,
            screenMode: ScreenMode.DESKTOP,
            displayCount: params.displayCount,
            displayIndex: params.displayIndex,
        },
        preInitiatedState: {},
        module: {
            ...kernelCoreUiRuntimeModule,
            screenParts: {
                primaryRootScreen,
                branchRootScreen,
                modalScreen,
            }
        }
    }

    const {store, persistor} = await ApplicationManager.getInstance().generateStore(appConfig)
    ApplicationManager.getInstance().init()
    await wait(50)
    return {store, persistor}
}

export function getUiRuntimeWorkspaceState(state: RootState, workspace: 'main' | 'branch') {
    return {
        screen: (state as any)[`${kernelCoreUiRuntimeWorkspaceState.screen}.${workspace}`],
        overlay: (state as any)[`${kernelCoreUiRuntimeWorkspaceState.overlay}.${workspace}`],
        uiVariables: (state as any)[`${kernelCoreUiRuntimeWorkspaceState.uiVariables}.${workspace}`],
    } as KernelCoreUiRuntimeWorkspaceState
}

export function getInstanceInfo(state: RootState) {
    return (state as any)[kernelCoreInterconnectionState.instanceInfo]
}

export async function setFastInterconnectionParameters() {
    kernelCoreBaseCommands.updateSystemParameters({
        [kernelCoreInterconnectionParameters.masterServerBootstrapDelayAfterStartup.key]: {
            value: 20,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.slaveConnectDelayAfterStartup.key]: {
            value: 20,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.masterServerReconnectInterval.key]: {
            value: 300,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.masterServerConnectionTimeout.key]: {
            value: 1500,
            updatedAt: Date.now(),
        },
        [kernelCoreInterconnectionParameters.remoteCommandResponseTimeout.key]: {
            value: 1500,
            updatedAt: Date.now(),
        },
    }).executeInternally()
    await wait(20)
}

export async function runSingleProcessAssertions() {
    const {store, persistor} = await createApp({
        deviceId: 'ui-runtime-single',
        displayCount: 1,
        displayIndex: 0,
    })

    const beforeState = store.getState() as RootState
    const info = getInstanceInfo(beforeState)
    assert(info.displayMode === DisplayMode.PRIMARY, 'single process should start in PRIMARY displayMode')
    assert(info.workspace === 'main', 'single process should start in MAIN workspace')

    const rootScreen = {
        partKey: primaryRootScreen.partKey,
        name: primaryRootScreen.name,
        title: primaryRootScreen.title,
        description: primaryRootScreen.description,
        containerKey: primaryRootScreen.containerKey,
    }

    kernelCoreUiRuntimeCommands.showScreen({target: rootScreen, source: 'single-test'}).executeInternally()
    await wait(20)

    kernelCoreUiRuntimeCommands.setUiVariables({
        'cashier.keyword': 'cola',
        'cashier.counter': 2,
    }).executeInternally()
    await wait(20)

    kernelCoreUiRuntimeCommands.openOverlay({
        overlay: {
            id: 'payment-modal',
            partKey: modalScreen.partKey,
            name: modalScreen.name,
            title: modalScreen.title,
            description: modalScreen.description,
            props: {amount: 88},
        }
    }).executeInternally()
    await wait(20)

    const stateAfterOpen = store.getState() as RootState
    const currentScreen = selectCurrentScreen(stateAfterOpen, 'primary.root.container')
    const keyword = selectUiVariable(stateAfterOpen, 'cashier.keyword', '')
    const overlays = selectCurrentOverlays(stateAfterOpen)
    const rawMainState = getUiRuntimeWorkspaceState(stateAfterOpen, 'main')

    assert(currentScreen?.partKey === primaryRootScreen.partKey, 'current screen should be written to main screen slice')
    assert(currentScreen?.source === 'single-test', 'screen source should be preserved')
    assert(keyword === 'cola', 'ui variable should be written to main uiVariables slice')
    assert(overlays.length === 1, 'overlay list should contain one entry after openOverlay')
    assert(rawMainState.overlay.primaryOverlays.value.length === 1, 'primary overlays should track the opened overlay')
    assert(rawMainState.uiVariables['cashier.counter']?.value === 2, 'uiVariables slice should keep raw value with updatedAt wrapper')

    kernelCoreUiRuntimeCommands.clearUiVariables(['cashier.keyword']).executeInternally()
    kernelCoreUiRuntimeCommands.closeOverlay({overlayId: 'payment-modal'}).executeInternally()
    kernelCoreUiRuntimeCommands.resetScreen({containerKey: 'primary.root.container'}).executeInternally()
    await wait(20)

    const finalState = store.getState() as RootState
    const finalScreen = selectCurrentScreen(finalState, 'primary.root.container')
    const finalKeyword = selectUiVariable(finalState, 'cashier.keyword', 'fallback')
    const finalOverlays = selectCurrentOverlays(finalState)
    const finalMainState = getUiRuntimeWorkspaceState(finalState, 'main')

    assert(finalScreen === undefined, 'resetScreen should clear current screen entry')
    assert(finalKeyword === 'fallback', 'cleared ui variable should resolve to caller default value')
    assert(finalOverlays.length === 0, 'closeOverlay should clear current overlay entry')
    assert(finalMainState.screen['primary.root.container']?.value === null, 'screen clear should be sync-friendly null entry')
    assert(finalMainState.uiVariables['cashier.keyword']?.value === null, 'ui variable clear should be sync-friendly null entry')

    await persistor.flush()
    await persistor.pause()

    return {
        workspace: info.workspace,
        displayMode: info.displayMode,
        overlayCountBeforeClose: overlays.length,
        overlayCountAfterClose: finalOverlays.length,
        keywordAfterClear: finalKeyword,
    }
}

export function resolveDevFile(...parts: string[]) {
    return path.join(process.cwd(), '1-kernel', '1.1-cores', 'ui-runtime', 'dev', ...parts)
}
