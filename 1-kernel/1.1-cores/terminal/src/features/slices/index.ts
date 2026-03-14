import {terminalConfig} from "./terminal";
import {generateUnitDataSliceConfig} from "./unitData";
import {kernelCoreTerminalUnitDataState} from "../../types/shared/moduleStateKey";
import {terminalConnectionConfig} from "./terminalConnection";


export const kernelCoreTerminalSlice = {
    terminal: terminalConfig,
    terminalConnection:terminalConnectionConfig,
    [kernelCoreTerminalUnitDataState.unitData_errorMessages]:
        generateUnitDataSliceConfig(kernelCoreTerminalUnitDataState.unitData_errorMessages),
    [kernelCoreTerminalUnitDataState.unitData_systemParameters]:
        generateUnitDataSliceConfig(kernelCoreTerminalUnitDataState.unitData_systemParameters),
    [kernelCoreTerminalUnitDataState.unitData_taskDefinitions]:
        generateUnitDataSliceConfig(kernelCoreTerminalUnitDataState.unitData_taskDefinitions)
}


