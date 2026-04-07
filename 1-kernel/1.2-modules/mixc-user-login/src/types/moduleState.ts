/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {UserState} from "./state";
import {kernelMixcUserLoginState, kernelMixcUserLoginUnitDataState} from "./shared/moduleStateKey";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelMixcUserLoginState {
    [kernelMixcUserLoginState.user]: UserState
    [kernelMixcUserLoginUnitDataState.unitData_user]: UnitDataState
}

export type KernelMixcUserLoginWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelMixcUserLoginInstanceState = CreateModuleInstanceModeStateType<{

}>