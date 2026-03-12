/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {UserState} from "@impos2/kernel-mixc-user";
import {UnitDataState} from "@impos2/kernel-core-terminal";
import {kernelMixcProductState, kernelMixcProductUnitDataState} from "./shared/moduleStateKey";
import {ContractState} from "./state/contract";

export interface KernelMixcProductState {
    [kernelMixcProductState.contract]: ContractState
    [kernelMixcProductUnitDataState.contract]: UnitDataState
}

export type KernelMixcProductWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelMixcProductInstanceState = CreateModuleInstanceModeStateType<{

}>