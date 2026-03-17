/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {CreateModuleInstanceModeStateType, CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {
    kernelMixcOrderPayState,
    kernelMixcOrderPayUnitDataState,
    kernelMixcOrderPayWorkspaceState
} from "./shared/moduleStateKey";
import {PayingOrderState} from "./state/payingOrderState";
import {PaymentFunctionState} from "./state/paymentFunctionState";
import {UnitDataState} from "@impos2/kernel-core-terminal";

export interface KernelMixcOrderPayState {
    [kernelMixcOrderPayState.paymentFunction]:PaymentFunctionState
    [kernelMixcOrderPayUnitDataState.unitData_paymentFunction]:UnitDataState
}

export type KernelMixcOrderPayWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelMixcOrderPayWorkspaceState.payingOrder]: PayingOrderState
}>
export type KernelMixcOrderPayInstanceState = CreateModuleInstanceModeStateType<{}>