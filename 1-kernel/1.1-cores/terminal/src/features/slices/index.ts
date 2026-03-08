import {terminalConfig} from "./terminal";
import {generateUnitDataSliceConfig} from "./unitData";
import {kernelCoreTerminalUnitDataState} from "../../types/shared/moduleStateKey";
import {terminalConnectionConfig} from "./terminalConnection";


export const kernelCoreTerminalSlice = {
    terminal: terminalConfig,
    terminalConnection:terminalConnectionConfig,
    [kernelCoreTerminalUnitDataState.errorMessages]:
        generateUnitDataSliceConfig(kernelCoreTerminalUnitDataState.errorMessages),
    [kernelCoreTerminalUnitDataState.systemParameters]:
        generateUnitDataSliceConfig(kernelCoreTerminalUnitDataState.systemParameters)
}