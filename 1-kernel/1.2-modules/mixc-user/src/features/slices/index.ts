import {userConfig} from "./user";
import {generateUnitDataSliceConfig, kernelCoreTerminalUnitDataState} from "@impos2/kernel-core-terminal";
import {kernelMixcUserUnitDataState} from "../../types/shared/moduleStateKey";


export const kernelMixcUserSlice = {
    userState:userConfig,
    [kernelMixcUserUnitDataState.unitData_user]:
        generateUnitDataSliceConfig(kernelMixcUserUnitDataState.unitData_user),
}