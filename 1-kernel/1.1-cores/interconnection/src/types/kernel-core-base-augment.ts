import {KernelCoreInterconnectionInstanceState, KernelCoreInterconnectionState} from "./moduleState";
import {SyncType} from "./shared/syncType";

declare module '@impos2/kernel-core-base' {
    // 使用声明合并扩展 RootState 接口
    export interface RootState extends KernelCoreInterconnectionState,
        KernelCoreInterconnectionInstanceState {
    }

    export interface ModuleSliceConfig<State = any> {
        syncType?: SyncType
    }
}
