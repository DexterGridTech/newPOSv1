
import {KernelCoreNavigationWorkspaceState} from "./moduleState";

declare module '@impos2/kernel-core-base-v1' {
    // 扩展 RootState 接口

    export interface RootStateBase extends KernelCoreNavigationWorkspaceState {
    }
}