/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {kernelMixcOrderBaseState, kernelMixcOrderBaseUnitDataState} from "./shared/moduleStateKey";
import {OrderState} from "./state";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelMixcOrderBaseState {
    [kernelMixcOrderBaseState.order]:OrderState
    [kernelMixcOrderBaseUnitDataState.order]:UnitDataState
}

export type KernelMixcOrderBaseWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelMixcOrderBaseInstanceState = CreateModuleInstanceModeStateType<{

}>