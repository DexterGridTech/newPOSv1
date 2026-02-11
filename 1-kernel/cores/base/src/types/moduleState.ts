import {RequestStatusState} from "./state";
import {ErrorMessagesState} from "./state/errorMessages";
import {SystemParametersState} from "@impos2/kernel-base";

/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */
interface PersistState {
    version: number;
    rehydrated: boolean;
}

export interface PersistPartial {
    _persist: PersistState;
}

export const kernelCoreBaseState = {
    requestStatus: "requestStatus",
    errorMessages:"errorMessages",
    systemParameters:"systemParameters"
} as const

export type KernelCoreBaseStateMap = {
    [kernelCoreBaseState.requestStatus]: RequestStatusState;
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
}


export interface RootStateBase extends KernelCoreBaseStateMap {
}

/** 扩展 RootState 接口(供其他模块扩展) */
export interface RootState extends RootStateBase,PersistPartial {
}