import {KernelXXXState,KernelXXXWorkspaceState,KernelXXXInstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootStateBase extends KernelXXXState,KernelXXXWorkspaceState,KernelXXXInstanceState {

    }
}