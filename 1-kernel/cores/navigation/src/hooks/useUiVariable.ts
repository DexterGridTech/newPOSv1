import {useSelector} from 'react-redux';
import {createSelector} from "@reduxjs/toolkit";
import {RootState, storeEntry, ValueWithUpdateAt} from "@impos2/kernel-core-base";
import {getWorkspace, kernelCoreInterconnectionState} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationState} from "../types/shared/moduleStateKey";
import {UiVariablesState} from "../types/state/uiVariables";
import {uiVariablesActions} from "../features/slices/uiVariables";

export interface UIVariable<T> {
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
                const entry = uiVariablesState?.[variableKey] as ValueWithUpdateAt<T> | undefined
                return entry?.value ?? defaultValue
            }
        )
        selectorCache.set(cacheKey, selector)
    }
    return selectorCache.get(cacheKey)!
}

export function useEditableUiVariable<T>(variable: UIVariable<T>): {
    value: T;
    setValue: (value: T) => void;
} {
    // 响应式获取 workspace，workspace 切换时组件会重渲染
    const workspace = useSelector((state: RootState) =>
        (state[kernelCoreInterconnectionState.instanceInfo as keyof RootState] as any)?.workspace
    )

    const stateKey = `${kernelCoreNavigationState.uiVariables}.${workspace}`
    const selector = getOrCreateSelector<T>(variable.key, variable.defaultValue, stateKey)
    const stateValue = useSelector((state: RootState) => selector(state) as T)

    const setValue = (value: T) => {
        const currentWorkspace = getWorkspace()
        const fullSliceName = `${kernelCoreNavigationState.uiVariables}.${currentWorkspace}`
        const action = uiVariablesActions.updateUiVariable({[variable.key]: value})
        storeEntry.dispatchAction({
            ...action,
            type: `${fullSliceName}/updateUiVariable`
        })
    }

    return {
        value: stateValue,
        setValue,
    }
}
