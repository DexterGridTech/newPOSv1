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
    [kernelCoreTerminalUnitDataState.unitData_systemParameters]: UnitDataState
    [kernelCoreTerminalUnitDataState.unitData_errorMessages]: UnitDataState
    [kernelCoreTerminalUnitDataState.unitData_taskDefinitions]: UnitDataState
}
