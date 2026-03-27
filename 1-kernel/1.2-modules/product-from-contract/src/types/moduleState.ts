/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {UserState} from "@impos2/kernel-user-base";
import {UnitDataState} from "@impos2/kernel-core-terminal";
import {kernelProductFromContractState, kernelProductFromContractUnitDataState} from "./shared/moduleStateKey";
import {ContractState} from "./state/contract";

export interface KernelProductFromContractState {
    [kernelProductFromContractState.contract]: ContractState
    [kernelProductFromContractUnitDataState.unitData_contract]: UnitDataState
}

export type KernelProductFromContractWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelProductFromContractInstanceState = CreateModuleInstanceModeStateType<{

}>