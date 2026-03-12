/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";

export interface uiMixcManagementState {
}

export type uiMixcManagementWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type uiMixcManagementInstanceState = CreateModuleInstanceModeStateType<{

}>