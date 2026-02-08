import {currentState} from "../core";
import {RootState} from "../features/rootState";
import {KernelBaseStateNames} from "../types/stateNames";

/**
 * 类型安全的状态选择器
 */
export function selectState<K extends keyof typeof KernelBaseStateNames>(
    stateKey: K
) {
    const state = currentState<RootState>();
    return state[KernelBaseStateNames[stateKey]];
}

export const selectInstance = () => {
    return selectState('instanceInfo').instance;
};
