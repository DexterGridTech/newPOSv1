import {userConfig} from "./user";
import {generateUnitDataSliceConfig, kernelCoreTerminalUnitDataState} from "@impos2/kernel-core-terminal";
import {kernelMixcUserLoginUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelMixcUserLoginSlice = {
    userState:userConfig,
    [kernelMixcUserLoginUnitDataState.unitData_user]:
        generateUnitDataSliceConfig(kernelMixcUserLoginUnitDataState.unitData_user),
}