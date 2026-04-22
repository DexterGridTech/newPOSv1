import { useSelector } from 'react-redux';
import { createSelector } from "@reduxjs/toolkit";
import { shortId } from "@impos2/kernel-core-base";
import { kernelCoreInterconnectionState } from "@impos2/kernel-core-interconnection";
import { kernelCoreNavigationWorkspaceState } from "../types/shared/moduleStateKey";
import { kernelCoreNavigationCommands } from "../features/commands";
const selectorCache = new Map();
function getOrCreateSelector(variableKey, defaultValue, stateKey) {
    const cacheKey = `${variableKey}.${stateKey}`;
    if (!selectorCache.has(cacheKey)) {
        const selector = createSelector([(s) => s[stateKey]], (uiVariablesState) => {
            const entry = uiVariablesState?.[variableKey];
            return entry?.value ?? defaultValue;
        });
        selectorCache.set(cacheKey, selector);
    }
    return selectorCache.get(cacheKey);
}
/**
 * 非 hook 的 selector，可在 hook 外部直接调用
 */
export function selectUiVariable(state, key, defaultValue) {
    const workspace = state[kernelCoreInterconnectionState.instanceInfo]?.workspace ?? 'main';
    const stateKey = `${kernelCoreNavigationWorkspaceState.uiVariables}.${workspace}`;
    const selector = getOrCreateSelector(key, defaultValue, stateKey);
    return selector(state);
}
export function useEditableUiVariable(variable) {
    const stateValue = useSelector((state) => selectUiVariable(state, variable.key, variable.defaultValue));
    const setValue = (value) => {
        kernelCoreNavigationCommands.setUiVariables({ [variable.key]: value }).execute(shortId());
    };
    return {
        value: stateValue,
        setValue,
    };
}
