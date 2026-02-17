import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {uiVariablesSliceConfig} from "./uiVariables";


export const kernelCoreNavigationSlice = {
    ...toModuleSliceConfigs(uiVariablesSliceConfig),
}