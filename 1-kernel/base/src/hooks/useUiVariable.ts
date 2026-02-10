import {useSelector} from 'react-redux';
import {createSelector} from "@reduxjs/toolkit";
import {SetUiVariablesCommand} from "../features/commands/shared";
import {generateUiVariableKey, UIVariable} from "../core/uiVariable";
import {RootState} from "../features/rootState";
import {KernelBaseStateNames} from "../types/stateNames";


const selectUiVariablesState = (state: RootState) => state[KernelBaseStateNames.uiVariables];

// 内部使用的 selector，不导出以避免与 accessToState 中的冲突
const selectInstanceFromState = (state: RootState) => state[KernelBaseStateNames.instanceInfo].instance;

// 缓存 selector 实例，避免重复创建
const selectorCache = new Map<string, ReturnType<typeof createSelector>>();

export const selectUiVariable = <T = any>(state: RootState, key: string): T => {
    // 检查缓存中是否已有该 key 的 selector
    if (!selectorCache.has(key)) {
        // 创建新的 selector 并缓存
        const selector = createSelector(
            [selectUiVariablesState, selectInstanceFromState],
            (uiVariablesState, instance): T => {
                const fullKey = generateUiVariableKey(key, instance.instanceMode, instance.displayMode);
                return uiVariablesState[fullKey];
            }
        );
        selectorCache.set(key, selector);
    }

    // 使用缓存的 selector
    return selectorCache.get(key)!(state) as T;
};


/**
 * UI 变量单向绑定 Hook 返回值
 */
export interface UseEditableUiVariableResult<T> {
    value: T;
    setValue: (value: T) => void;
}

export function useEditableUiVariable<T>(variable: UIVariable<T>): UseEditableUiVariableResult<T> {

    // 从 Redux state 获取初始值
    const stateValue = useSelector((state: RootState) =>
        selectUiVariable<T>(state, variable.key)) || variable.defaultValue;
    const setUiVariable = <T>(value: T) => {
        new SetUiVariablesCommand({
            uiVariables: {
                [variable.key]: value
            }
        }).executeInternally();
    }
    return {
        value: stateValue,
        setValue: setUiVariable,
    };
}
