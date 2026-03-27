/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {UserState} from "./state";
import {kernelUserBaseState, kernelUserBaseUnitDataState} from "./shared/moduleStateKey";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelUserBaseState {
    [kernelUserBaseState.user]: UserState
    [kernelUserBaseUnitDataState.unitData_user]: UnitDataState
}

export type KernelUserBaseWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelUserBaseInstanceState = CreateModuleInstanceModeStateType<{

}>