import {KernelMixcProductState,KernelMixcProductWorkspaceState,KernelMixcProductInstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootState extends KernelMixcProductState,KernelMixcProductWorkspaceState,KernelMixcProductInstanceState {

    }
}