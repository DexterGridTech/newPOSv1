import {KernelMixcUserInstanceState, KernelMixcUserState, KernelMixcUserWorkspaceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口
    export interface RootState extends KernelMixcUserState,KernelMixcUserWorkspaceState,KernelMixcUserInstanceState {

    }
}