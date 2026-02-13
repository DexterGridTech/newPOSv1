import {RequestStatusState} from "./state/requestStatus";
import {ErrorMessagesState} from "./state/errorMessages";
import {SystemParametersState} from "./state/systemParameters";
import {kernelCoreBaseState} from "./shared/moduleStateKey";

/**
 * 核心状态映射类型
 */
interface KernelCoreBaseState {
    [kernelCoreBaseState.requestStatus]: RequestStatusState;
    [kernelCoreBaseState.errorMessages]: ErrorMessagesState;
    [kernelCoreBaseState.systemParameters]: SystemParametersState;
    _persist: {
        version: number;
        rehydrated: boolean;
    };
}


/**
 * RootState 接口（供其他模块扩展）
 * 使用 interface 支持声明合并
 * 注意：PersistPartial 通过交叉类型添加，避免索引签名冲突
 */
export interface RootState extends KernelCoreBaseState{
}

/**
 * 完整的 RootState 类型（包含 PersistPartial）
 * 用于实际的类型标注
 */