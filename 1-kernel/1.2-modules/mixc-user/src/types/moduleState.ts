/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {UserState} from "./state";
import {kernelMixcUserState, kernelMixcUserUnitDataState} from "./shared/moduleStateKey";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelMixcUserState {
    [kernelMixcUserState.user]: UserState
    [kernelMixcUserUnitDataState.user]: UnitDataState
}

export type KernelMixcUserWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelMixcUserInstanceState = CreateModuleInstanceModeStateType<{

}>