/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */ import {kernelTerminalState} from "./shared/moduleStateKey";
import {TerminalState} from "./state/terminalState";

export interface  KernelTerminalState  {
    [kernelTerminalState.terminal]: TerminalState
}