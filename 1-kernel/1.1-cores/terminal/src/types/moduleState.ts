/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */ import {kernelCoreTerminalState, kernelCoreTerminalUnitDataState} from "./shared/moduleStateKey";
import {TerminalState} from "./state/terminalState";
import {UnitDataState} from "./state/unitData";
import {TerminalConnectionState} from "./state";

export interface  KernelCoreTerminalState  {
    [kernelCoreTerminalState.terminal]: TerminalState
    [kernelCoreTerminalState.terminalConnection]: TerminalConnectionState
    [kernelCoreTerminalUnitDataState.systemParameters]: UnitDataState
    [kernelCoreTerminalUnitDataState.errorMessages]: UnitDataState
    [kernelCoreTerminalUnitDataState.taskDefinitions]: UnitDataState
}
