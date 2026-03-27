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
import {PayingOrderState} from "./state/payingOrder";
import {PaymentFunctionState} from "./state/paymentFunction";
import {UnitDataState} from "@impos2/kernel-core-terminal";
import {PaymentRequestStatus} from "./shared/paymentRequest";

export interface KernelPayBaseState {
    [kernelPayBaseState.paymentFunction]:PaymentFunctionState
    [kernelPayBaseUnitDataState.unitData_paymentFunction]:UnitDataState
}

export type KernelPayBaseWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelPayBaseWorkspaceState.payingOrder]: PayingOrderState
    [kernelPayBaseWorkspaceState.paymentRequest]: PaymentRequestStatus
}>
export type KernelPayBaseInstanceState = CreateModuleInstanceModeStateType<{}>