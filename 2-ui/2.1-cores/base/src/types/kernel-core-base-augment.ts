import {uiCoreBaseState,uiCoreBaseWorkspaceState,uiCoreBaseInstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootState extends uiCoreBaseState,uiCoreBaseWorkspaceState,uiCoreBaseInstanceState {

    }
}