/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {kernelCoreTaskState} from "./shared/moduleStateKey";
import {TaskDefinitionState} from "./state";

export interface KernelCoreTaskState {
    [kernelCoreTaskState.taskDefinitions]:TaskDefinitionState
}

export type KernelCoreTaskWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type KernelCoreTaskInstanceState = CreateModuleInstanceModeStateType<{

}>