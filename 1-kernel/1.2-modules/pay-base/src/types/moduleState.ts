/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {CreateModuleInstanceModeStateType, CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {
    kernelPayBaseState,
    kernelPayBaseUnitDataState,
    kernelPayBaseWorkspaceState
} from "./shared/moduleStateKey";
import {PayingOrderState} from "./state/payingOrderState";
import {PaymentFunctionState} from "./state/paymentFunctionState";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelPayBaseState {
    [kernelPayBaseState.paymentFunction]:PaymentFunctionState
    [kernelPayBaseUnitDataState.unitData_paymentFunction]:UnitDataState
}

export type KernelPayBaseWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelPayBaseWorkspaceState.payingOrder]: PayingOrderState
}>
export type KernelPayBaseInstanceState = CreateModuleInstanceModeStateType<{}>