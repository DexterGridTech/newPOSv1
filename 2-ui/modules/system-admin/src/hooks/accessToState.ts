import {currentState, instanceInfoSlice, RootState} from "@impos2/kernel-base";

/**
 * 获取当前的 Workspace 配置
 */
export const selectWorkspace = () => {
    return currentState<RootState>()[instanceInfoSlice.name].workspace;
};
