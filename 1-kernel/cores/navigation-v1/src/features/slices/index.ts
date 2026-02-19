import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection-v1";
import {uiVariablesSliceConfig} from "./uiVariables";


export const kernelCoreNavigationSlice = {
    ...toModuleSliceConfigs(uiVariablesSliceConfig),
}