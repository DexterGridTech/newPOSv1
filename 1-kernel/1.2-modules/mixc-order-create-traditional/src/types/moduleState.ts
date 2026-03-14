/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {CreateModuleInstanceModeStateType, CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {kernelMixcOrderCreateTraditionalWorkspaceState} from "./shared/moduleStateKey";
import {CreateOrderState} from "./state/createOrderState";

export interface KernelMixcOrderCreateTraditionalState {
}

export type KernelMixcOrderCreateTraditionalWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelMixcOrderCreateTraditionalWorkspaceState.createOrder]: CreateOrderState
}>
export type KernelMixcOrderCreateTraditionalInstanceState = CreateModuleInstanceModeStateType<{}>