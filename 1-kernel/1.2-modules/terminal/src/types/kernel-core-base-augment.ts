import {KernelTerminalState} from "./moduleState";
import {kernelTerminalUnitDataState} from "./shared";

declare module '@impos2/kernel-core-base' {
    // 扩展 RootState 接口
    export interface RootState extends KernelTerminalState{

    }
}