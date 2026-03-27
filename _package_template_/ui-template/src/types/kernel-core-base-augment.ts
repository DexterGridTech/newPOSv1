import {ui{{PACKAGE_NAME_PASCAL}}State,ui{{PACKAGE_NAME_PASCAL}}WorkspaceState,ui{{PACKAGE_NAME_PASCAL}}InstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootState extends ui{{PACKAGE_NAME_PASCAL}}State,ui{{PACKAGE_NAME_PASCAL}}WorkspaceState,ui{{PACKAGE_NAME_PASCAL}}InstanceState {

    }
}