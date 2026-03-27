import {Kernel{{PACKAGE_NAME_PASCAL}}State,Kernel{{PACKAGE_NAME_PASCAL}}WorkspaceState,Kernel{{PACKAGE_NAME_PASCAL}}InstanceState} from "./moduleState";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口

    export interface RootState extends Kernel{{PACKAGE_NAME_PASCAL}}State,Kernel{{PACKAGE_NAME_PASCAL}}WorkspaceState,Kernel{{PACKAGE_NAME_PASCAL}}InstanceState {

    }
}