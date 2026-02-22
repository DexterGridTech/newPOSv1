import {uiIntegrationDesktopState,uiIntegrationDesktopWorkspaceState,uiIntegrationDesktopInstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootStateBase extends uiIntegrationDesktopState,uiIntegrationDesktopWorkspaceState,uiIntegrationDesktopInstanceState {

    }
}