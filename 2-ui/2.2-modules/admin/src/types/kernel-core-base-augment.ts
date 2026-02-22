import {uiAdminState,uiAdminWorkspaceState,uiAdminInstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootStateBase extends uiAdminState,uiAdminWorkspaceState,uiAdminInstanceState {

    }
}