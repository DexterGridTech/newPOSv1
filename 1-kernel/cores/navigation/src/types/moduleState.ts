/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {kernelCoreNavigationWorkspaceState} from "./shared/moduleStateKey";
import {UiVariablesState} from "./state/uiVariables";
import {CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";


export type KernelCoreNavigationWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelCoreNavigationWorkspaceState.uiVariables]: UiVariablesState,
}>
