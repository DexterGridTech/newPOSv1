import {CreateModuleWorkspaceStateType} from "@impos2/kernel-core-interconnection";
import {kernelOrderCreateTraditionalWorkspaceState} from "./shared/moduleStateKey";
import {CreateOrderState} from "./state/createOrder";

export interface KernelOrderCreateTraditionalState {
}

export type KernelOrderCreateTraditionalWorkspaceState = CreateModuleWorkspaceStateType<{
    [kernelOrderCreateTraditionalWorkspaceState.createOrder]: CreateOrderState
}>
