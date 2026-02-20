/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection-v1";

export interface KernelXXXState {
}

export type KernelXXXWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelXXXInstanceState = CreateModuleInstanceModeStateType<{

}>