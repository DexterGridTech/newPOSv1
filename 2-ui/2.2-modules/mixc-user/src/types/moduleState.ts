/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";

export interface uiMixcUserState {
}

export type uiMixcUserWorkspaceState = CreateModuleWorkspaceStateType<{

}>
export type uiMixcUserInstanceState = CreateModuleInstanceModeStateType<{

}>