import {RequestStatusState} from "./state/requestStatus";
import {ErrorMessagesState} from "./state/errorMessages";
import {SystemParametersState} from "./state/systemParameters";
import {kernelCoreBaseState} from "./shared/moduleStateKey";

/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */

type KernelCoreBaseStateMap = {
    [kernelCoreBaseState.requestStatus]: RequestStatusState;
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
}

interface PersistPartial {
    _persist?: {
        version: number;
        rehydrated: boolean;
    };
}
/** 扩展 RootState 接口(供其他模块扩展) */
export interface RootState extends KernelCoreBaseStateMap,PersistPartial {
}