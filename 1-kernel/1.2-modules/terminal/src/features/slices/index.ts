import {terminalConfig} from "./terminal";
import {generateUnitDataSliceConfig} from "./unitData";
import {kernelTerminalUnitDataState} from "../../types/shared/moduleStateKey";
import {terminalConnectionConfig} from "./terminalConnection";


export const kernelTerminalSlice = {
    terminal: terminalConfig,
    terminalConnection:terminalConnectionConfig,
    [kernelTerminalUnitDataState.errorMessages]:
        generateUnitDataSliceConfig(kernelTerminalUnitDataState.errorMessages),
    [kernelTerminalUnitDataState.systemParameters]:
        generateUnitDataSliceConfig(kernelTerminalUnitDataState.systemParameters)
}