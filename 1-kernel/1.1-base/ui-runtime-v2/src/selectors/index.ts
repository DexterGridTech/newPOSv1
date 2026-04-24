import type {RootState} from '@next/kernel-base-state-runtime'
import {
    selectTopologyDisplayMode,
    selectTopologyInstanceMode,
    selectTopologyWorkspace,
} from '@next/kernel-base-topology-runtime-v3'
import {createUiScreenRegistry} from '../foundations/screenRegistry'
import {
    uiRuntimeV2OverlayWorkspaceKeys,
    uiRuntimeV2ScreenWorkspaceKeys,
    uiRuntimeV2VariableWorkspaceKeys,
} from '../features/slices'
import type {
    UiOverlayEntry,
    UiOverlayRuntimeState,
    UiScreenDefinition,
    UiScreenRegistryContext,
    UiScreenRuntimeEntry,
    UiScreenRuntimeState,
} from '../types'

const sharedRegistry = createUiScreenRegistry()

export const normalizeUiRuntimeWorkspace = (workspace?: string) => {
    if (workspace === 'BRANCH') {
        return 'branch'
    }
    if (workspace === 'MAIN') {
        return 'main'
    }
    return workspace ?? 'main'
}

export const registerUiScreenDefinitions = (
    definitions: readonly UiScreenDefinition[],
) => sharedRegistry.registerMany(definitions)

export const getUiScreenRegistry = () => sharedRegistry

export const registerUiScreenDefinition = (
    definition: UiScreenDefinition,
) => sharedRegistry.register(definition)

export const selectUiScreenRendererKey = (partKey: string) =>
    sharedRegistry.getRendererKey(partKey)

export const selectUiRuntimeCurrentWorkspace = (state: RootState) =>
    normalizeUiRuntimeWorkspace(selectTopologyWorkspace(state))

export const selectUiRuntimeCurrentDisplayMode = (state: RootState) =>
    selectTopologyDisplayMode(state) ?? 'PRIMARY'

export const selectUiRuntimeCurrentInstanceMode = (state: RootState) =>
    selectTopologyInstanceMode(state) ?? 'MASTER'

export const selectUiScreen = <TProps = unknown>(
    state: RootState,
    containerKey: string,
    defaultValue?: UiScreenRuntimeEntry<TProps> | null,
) => {
    const workspace = selectUiRuntimeCurrentWorkspace(state) as keyof typeof uiRuntimeV2ScreenWorkspaceKeys
    const scopedKey = uiRuntimeV2ScreenWorkspaceKeys[workspace]
    const screenState = state[scopedKey as keyof RootState] as UiScreenRuntimeState | undefined
    if (screenState && containerKey in screenState) {
        return screenState[containerKey]?.value as UiScreenRuntimeEntry<TProps> | null | undefined
    }
    return defaultValue
}

export const selectUiOverlays = (
    state: RootState,
    displayMode?: string,
): readonly UiOverlayEntry[] => {
    const workspace = selectUiRuntimeCurrentWorkspace(state) as keyof typeof uiRuntimeV2OverlayWorkspaceKeys
    const scopedKey = uiRuntimeV2OverlayWorkspaceKeys[workspace]
    const overlayState = state[scopedKey as keyof RootState] as UiOverlayRuntimeState | undefined
    const mode = displayMode ?? selectUiRuntimeCurrentDisplayMode(state)
    return mode === 'SECONDARY'
        ? overlayState?.secondaryOverlays.value ?? []
        : overlayState?.primaryOverlays.value ?? []
}

export const selectUiVariable = <TValue = unknown>(
    state: RootState,
    key: string,
    defaultValue?: TValue,
) => {
    const workspace = selectUiRuntimeCurrentWorkspace(state) as keyof typeof uiRuntimeV2VariableWorkspaceKeys
    const scopedKey = uiRuntimeV2VariableWorkspaceKeys[workspace]
    const variableState = state[scopedKey as keyof RootState] as Record<string, {value?: TValue | null}> | undefined
    if (variableState && key in variableState) {
        return variableState[key]?.value as TValue | null | undefined
    }
    return defaultValue
}

export const buildUiScreenRegistryContext = (
    state: RootState,
    overrides: Partial<UiScreenRegistryContext> = {},
): UiScreenRegistryContext => ({
    screenMode: overrides.screenMode ?? 'DESKTOP',
    workspace: overrides.workspace ?? selectUiRuntimeCurrentWorkspace(state),
    instanceMode: overrides.instanceMode ?? selectUiRuntimeCurrentInstanceMode(state),
})

export const selectUiScreenDefinition = (
    partKey: string,
) => sharedRegistry.get(partKey)

export const selectUiScreenDefinitionsByContainer = (
    state: RootState,
    containerKey: string,
    overrides: Partial<UiScreenRegistryContext> = {},
) => sharedRegistry.listByContainer(
    containerKey,
    buildUiScreenRegistryContext(state, overrides),
)

export const selectFirstReadyUiScreenDefinition = (
    state: RootState,
    containerKey: string,
    fromIndex = -1,
    overrides: Partial<UiScreenRegistryContext> = {},
) => sharedRegistry.findFirstReady(
    containerKey,
    fromIndex,
    buildUiScreenRegistryContext(state, overrides),
)

export const selectUiCurrentScreenOrFirstReady = (
    state: RootState,
    containerKey: string,
    fromIndex = -1,
    overrides: Partial<UiScreenRegistryContext> = {},
) => selectUiScreen(state, containerKey)
    ?? selectFirstReadyUiScreenDefinition(state, containerKey, fromIndex, overrides)
