/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
import {
    CreateModuleInstanceModeStateType,
    CreateModuleWorkspaceStateType
} from "@impos2/kernel-core-interconnection";
import {OrderCreationState} from "./state/orderCreation";
import {uiMixcTradeWorkspaceState} from "./shared/moduleStateKey";

export interface UiMixcTradeState {
}

export type UiMixcTradeWorkspaceState = CreateModuleWorkspaceStateType<{
    [uiMixcTradeWorkspaceState.orderCreation]: OrderCreationState
}>
export type UiMixcTradeInstanceState = CreateModuleInstanceModeStateType<{

}>