/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {kernelOrderBaseState, kernelOrderBaseUnitDataState} from "./shared/moduleStateKey";
import {OrderState} from "./state";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelOrderBaseState {
    [kernelOrderBaseState.order]:OrderState
    [kernelOrderBaseUnitDataState.unitData_order]:UnitDataState
}

export type KernelOrderBaseWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelOrderBaseInstanceState = CreateModuleInstanceModeStateType<{

}>