import {useSelector} from 'react-redux';
import {createSelector} from "@reduxjs/toolkit";
import {RootState, ValueWithUpdateAt} from "@impos2/kernel-core-base";
import {getWorkspace} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationState} from "../types/shared/moduleStateKey";
import {UiVariablesState} from "../types/state/uiVariables";
import {uiVariablesActions} from "../features/slices/uiVariables";
import {storeEntry} from "@impos2/kernel-core-base";

export interface UIVariable<T> {
    key: string,
    defaultValue: T
}

const selectorCache = new Map<string, ReturnType<typeof createSelector>>();

export function useEditableUiVariable<T>(variable: UIVariable<T>): {
    value: T;
    setValue: (value: T) => void;
} {
    const workspace = getWorkspace()
    const stateKey = `${kernelCoreNavigationState.uiVariables}.${workspace}` as keyof RootState

    const stateValue = useSelector((state: RootState) => {
        const cacheKey = `${variable.key}.${workspace}`
        if (!selectorCache.has(cacheKey)) {
            const selector = createSelector(
                [(s: RootState) => s[stateKey] as UiVariablesState],
                (uiVariablesState): T => {
                    const entry = uiVariablesState?.[variable.key] as ValueWithUpdateAt<T> | undefined
                    return entry?.value ?? variable.defaultValue
                }
            )
            selectorCache.set(cacheKey, selector)
        }
        return selectorCache.get(cacheKey)!(state) as T
    })

    const setValue = (value: T) => {
        const workspace = getWorkspace()
        const fullSliceName = `${kernelCoreNavigationState.uiVariables}.${workspace}`
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
