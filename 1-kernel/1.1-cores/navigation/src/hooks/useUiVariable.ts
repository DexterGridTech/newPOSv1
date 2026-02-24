import {useSelector} from 'react-redux';
import {createSelector} from "@reduxjs/toolkit";
import {RootState, shortId, ValueWithUpdatedAt} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionState} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationWorkspaceState} from "../types/shared/moduleStateKey";
import {UiVariablesState} from "../types/state/uiVariables";
import {kernelCoreNavigationCommands} from "../features/commands";

export interface UiVariable<T> {
    key: string,
    defaultValue: T
}

const selectorCache = new Map<string, ReturnType<typeof createSelector>>();

function getOrCreateSelector<T>(variableKey: string, defaultValue: T, stateKey: string) {
    const cacheKey = `${variableKey}.${stateKey}`
    if (!selectorCache.has(cacheKey)) {
        const selector = createSelector(
            [(s: RootState) => s[stateKey as keyof RootState] as UiVariablesState],
            (uiVariablesState): T => {
                const entry = uiVariablesState?.[variableKey] as ValueWithUpdatedAt<T> | undefined
                return entry?.value ?? defaultValue
            }
        )
        selectorCache.set(cacheKey, selector)
    }
    return selectorCache.get(cacheKey)!
}

/**
 * 非 hook 的 selector，可在 hook 外部直接调用
 */
export function selectUiVariable<T>(state: RootState, key: string, defaultValue: T): T {
    const workspace = (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace ?? 'main'
    const stateKey = `${kernelCoreNavigationWorkspaceState.uiVariables}.${workspace}`
    const selector = getOrCreateSelector<T>(key, defaultValue, stateKey)
    return selector(state) as T
}

export function useEditableUiVariable<T>(variable: UiVariable<T>): {
    value: T;
    setValue: (value: T) => void;
} {
    const stateValue = useSelector((state: RootState) =>
        selectUiVariable<T>(state, variable.key, variable.defaultValue)
    )

    const setValue = (value: T) => {
        kernelCoreNavigationCommands.setUiVariables({[variable.key]: value}).execute(shortId())
    }

    return {
        value: stateValue,
        setValue,
    }
}
