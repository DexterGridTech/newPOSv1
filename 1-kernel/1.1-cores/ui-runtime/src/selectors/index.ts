import {createSelector} from "@reduxjs/toolkit";
import {RootState, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {DisplayMode, kernelCoreInterconnectionState} from "@impos2/kernel-core-interconnection";
import {kernelCoreUiRuntimeWorkspaceState} from "../types/shared/moduleStateKey";
import {OverlayEntry, OverlayRuntimeState, ScreenEntry, ScreenRuntimeState, UiVariablesState} from "../types";

const selectorCache = new Map<string, ReturnType<typeof createSelector>>();
const emptyOverlays: OverlayEntry<any>[] = []

function getWorkspace(state: RootState): string {
    return ((state as any)[kernelCoreInterconnectionState.instanceInfo]?.workspace ?? 'main') as string
}

function getDisplayMode(state: RootState): DisplayMode {
    return ((state as any)[kernelCoreInterconnectionState.instanceInfo]?.displayMode ?? DisplayMode.PRIMARY) as DisplayMode
}

function getOrCreateUiVariableSelector<T>(variableKey: string, stateKey: string) {
    const cacheKey = `ui.${variableKey}.${stateKey}`
    if (!selectorCache.has(cacheKey)) {
        const selector = createSelector(
            [(s: RootState) => (s as any)[stateKey] as UiVariablesState | undefined],
            (uiVariablesState): T | undefined | null => {
                const entry = uiVariablesState?.[variableKey] as ValueWithUpdatedAt<T> | undefined
                return entry?.value
            }
        )
        selectorCache.set(cacheKey, selector)
    }
    return selectorCache.get(cacheKey)!
}

function getOrCreateScreenSelector<T>(containerKey: string, stateKey: string) {
    const cacheKey = `screen.${containerKey}.${stateKey}`
    if (!selectorCache.has(cacheKey)) {
        const selector = createSelector(
            [(s: RootState) => (s as any)[stateKey] as ScreenRuntimeState | undefined],
            (screenState): T | undefined | null => {
                const entry = screenState?.[containerKey] as ValueWithUpdatedAt<T> | undefined
                return entry?.value
            }
        )
        selectorCache.set(cacheKey, selector)
    }
    return selectorCache.get(cacheKey)!
}

export function selectUiVariable<T>(state: RootState, key: string, defaultValue: T): T {
    const workspace = getWorkspace(state)
    const stateKey = `${kernelCoreUiRuntimeWorkspaceState.uiVariables}.${workspace}`
    const selector = getOrCreateUiVariableSelector<T>(key, stateKey)
    return (selector(state) ?? defaultValue) as T
}

export function selectCurrentScreen<T = ScreenEntry<any> | undefined>(state: RootState, containerKey: string, defaultValue?: T): T {
    const workspace = getWorkspace(state)
    const stateKey = `${kernelCoreUiRuntimeWorkspaceState.screen}.${workspace}`
    const selector = getOrCreateScreenSelector<T>(containerKey, stateKey)
    return (selector(state) ?? defaultValue) as T
}

export function selectCurrentOverlays(state: RootState) {
    const workspace = getWorkspace(state)
    const displayMode = getDisplayMode(state)
    const stateKey = `${kernelCoreUiRuntimeWorkspaceState.overlay}.${workspace}`
    const overlayState = (state as any)[stateKey] as OverlayRuntimeState | undefined
    return displayMode === DisplayMode.PRIMARY
        ? overlayState?.primaryOverlays?.value ?? emptyOverlays
        : overlayState?.secondaryOverlays?.value ?? emptyOverlays
}
