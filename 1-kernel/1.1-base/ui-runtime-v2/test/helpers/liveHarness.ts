import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createTopologyRuntimeV3LiveHarness,
    waitFor,
} from '../../../topology-runtime-v3/test/helpers/runtimeLiveHarness'
import {
    selectTopologyRuntimeV3Connection,
    selectTopologyRuntimeV3Context,
    topologyRuntimeV3CommandDefinitions,
} from '@impos2/kernel-base-topology-runtime-v3'
import {
    createUiRuntimeModuleV2,
    registerUiScreenDefinitions,
    type UiScreenDefinition,
} from '../../src'
import {
    uiRuntimeV2OverlayWorkspaceKeys,
    uiRuntimeV2ScreenWorkspaceKeys,
    uiRuntimeV2VariableWorkspaceKeys,
} from '../../src/features/slices'

export const testPrimaryScreenDefinition: UiScreenDefinition = {
    partKey: 'ui-runtime-v2.test.primary-root',
    rendererKey: 'ui.test.primary-root',
    name: 'Primary Root',
    title: 'Primary Root',
    description: 'Primary test screen',
    containerKey: 'primary.root.container',
    indexInContainer: 0,
    screenModes: ['DESKTOP'],
    workspaces: ['main'],
    instanceModes: ['MASTER'],
}

export const testSecondaryScreenDefinition: UiScreenDefinition = {
    partKey: 'ui-runtime-v2.test.secondary-root',
    rendererKey: 'ui.test.secondary-root',
    name: 'Secondary Root',
    title: 'Secondary Root',
    description: 'Secondary test screen',
    containerKey: 'secondary.root.container',
    indexInContainer: 0,
    screenModes: ['DESKTOP'],
    workspaces: ['branch'],
    instanceModes: ['SLAVE'],
}

export const testModalDefinition: UiScreenDefinition = {
    partKey: 'ui-runtime-v2.test.modal',
    rendererKey: 'ui.test.modal',
    name: 'Test Modal',
    title: 'Test Modal',
    description: 'Test modal',
    screenModes: ['DESKTOP'],
    workspaces: ['main', 'branch'],
    instanceModes: ['MASTER', 'SLAVE'],
}

export const createUiRuntimeV2LiveHarness = async (input: {
    profileName: string
    reconnectIntervalMs?: number
    reconnectAttempts?: number
    slaveDisplayIndex?: number
    slaveDisplayCount?: number
    slaveDisplayMode?: 'PRIMARY' | 'SECONDARY'
}) => {
    registerUiScreenDefinitions([
        testPrimaryScreenDefinition,
        testSecondaryScreenDefinition,
        testModalDefinition,
    ])

    const topologyHarness = await createTopologyRuntimeV3LiveHarness({
        profileName: input.profileName,
        reconnectIntervalMs: input.reconnectIntervalMs,
        reconnectAttempts: input.reconnectAttempts,
        slaveDisplayIndex: input.slaveDisplayIndex,
        slaveDisplayCount: input.slaveDisplayCount,
    })

    const masterRuntime = topologyHarness.createMasterRuntime([
        createUiRuntimeModuleV2(),
    ])
    const slaveRuntime = topologyHarness.createSlaveRuntime([
        createUiRuntimeModuleV2(),
    ])

    await masterRuntime.start()
    await slaveRuntime.start()

    return {
        ...topologyHarness,
        masterRuntime,
        slaveRuntime,
        async configureTopologyPair() {
            await topologyHarness.configureDefaultPair(masterRuntime, slaveRuntime, {
                slaveDisplayMode: input.slaveDisplayMode,
            })
        },
        async startTopologyConnectionPair() {
            await topologyHarness.startTopologyConnectionPair(masterRuntime, slaveRuntime, 5_000)
        },
        async waitForSlaveContext(inputValue: {
            displayMode: 'PRIMARY' | 'SECONDARY'
            workspace: 'MAIN' | 'BRANCH'
        }, timeoutMs = 5_000) {
            await waitFor(() => {
                const context = selectTopologyRuntimeV3Context(slaveRuntime.getState())
                return context?.instanceMode === 'SLAVE'
                    && context.displayMode === inputValue.displayMode
                    && context.workspace === inputValue.workspace
            }, timeoutMs)
        },
        async waitForSlaveSecondaryMainContext(timeoutMs = 5_000) {
            await this.waitForSlaveContext({
                displayMode: 'SECONDARY',
                workspace: 'MAIN',
            }, timeoutMs)
        },
        async waitForSlaveScreen(partKey: string, timeoutMs = 5_000) {
            await waitFor(() => {
                const state = slaveRuntime.getState() as Record<string, unknown>
                const screenState = state[uiRuntimeV2ScreenWorkspaceKeys.main] as Record<string, {value?: {partKey?: string}}> | undefined
                return screenState?.[testPrimaryScreenDefinition.containerKey!]?.value?.partKey === partKey
            }, timeoutMs)
        },
        async waitForSlaveOverlayCount(count: number, timeoutMs = 5_000) {
            await waitFor(() => {
                const state = slaveRuntime.getState() as Record<string, unknown>
                const overlayState = state[uiRuntimeV2OverlayWorkspaceKeys.main] as {primaryOverlays?: {value?: unknown[]}} | undefined
                return (overlayState?.primaryOverlays?.value ?? []).length === count
            }, timeoutMs)
        },
        async waitForSlaveVariable<TValue = unknown>(
            key: string,
            predicate: (value: TValue | undefined | null) => boolean,
            timeoutMs = 5_000,
        ) {
            try {
                await waitFor(() => {
                    const state = slaveRuntime.getState() as Record<string, unknown>
                    const variableState = state[uiRuntimeV2VariableWorkspaceKeys.main] as Record<string, {value?: TValue | null}> | undefined
                    return predicate(variableState?.[key]?.value)
                }, timeoutMs)
            } catch (error) {
                throw new Error([
                    error instanceof Error ? error.message : String(error),
                    `slaveUiSlices=${JSON.stringify(this.getRuntimeUiSlices(slaveRuntime))}`,
                    `masterUiSlices=${JSON.stringify(this.getRuntimeUiSlices(masterRuntime))}`,
                ].join('\n'))
            }
        },
        getRuntimeUiSlices(runtime: typeof slaveRuntime) {
            const state = runtime.getState() as Record<string, unknown>
            return {
                screenMain: state[uiRuntimeV2ScreenWorkspaceKeys.main],
                screenBranch: state[uiRuntimeV2ScreenWorkspaceKeys.branch],
                overlayMain: state[uiRuntimeV2OverlayWorkspaceKeys.main],
                overlayBranch: state[uiRuntimeV2OverlayWorkspaceKeys.branch],
                variableMain: state[uiRuntimeV2VariableWorkspaceKeys.main],
                variableBranch: state[uiRuntimeV2VariableWorkspaceKeys.branch],
            }
        },
        async close() {
            await masterRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                {},
            ))
            await slaveRuntime.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.stopTopologyConnection,
                {},
            ))
            await topologyHarness.close()
        },
    }
}
