import {KernelCoreInterconnectionState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 使用声明合并扩展 RootState 接口
    export interface RootState extends KernelCoreInterconnectionState {
    }
}