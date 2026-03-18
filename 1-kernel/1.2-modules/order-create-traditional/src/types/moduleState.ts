/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {CreateModuleInstanceModeStateType, CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {kernelOrderCreateTraditionalWorkspaceState} from "./shared/moduleStateKey";
import {CreateOrderState} from "./state/createOrderState";

export interface KernelOrderCreateTraditionalState {
}

export type KernelOrderCreateTraditionalWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelOrderCreateTraditionalWorkspaceState.createOrder]: CreateOrderState
}>
export type KernelOrderCreateTraditionalInstanceState = CreateModuleInstanceModeStateType<{}>