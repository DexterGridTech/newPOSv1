import {userConfig} from "./user";
import {generateUnitDataSliceConfig, kernelCoreTerminalUnitDataState} from "@impos2/kernel-core-terminal";
import {kernelUserBaseUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelUserBaseSlice = {
    userState:userConfig,
    [kernelUserBaseUnitDataState.unitData_user]:
        generateUnitDataSliceConfig(kernelUserBaseUnitDataState.unitData_user),
}