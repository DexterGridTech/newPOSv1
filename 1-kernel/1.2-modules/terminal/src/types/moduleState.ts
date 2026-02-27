/**
 * Redux Persist 的状态接口
 * 直接定义，避免导入问题
 */ import {kernelTerminalState, kernelTerminalUnitDataState} from "./shared/moduleStateKey";
import {TerminalState} from "./state/terminalState";
import {UnitDataState} from "./state/unitData";
import {TerminalConnectionState} from "./state";

export interface  KernelTerminalState  {
    [kernelTerminalState.terminal]: TerminalState
    [kernelTerminalState.terminalConnection]: TerminalConnectionState
    [kernelTerminalUnitDataState.systemParameters]: UnitDataState
    [kernelTerminalUnitDataState.errorMessages]: UnitDataState
    [kernelTerminalUnitDataState.taskDefinitions]: UnitDataState
}
