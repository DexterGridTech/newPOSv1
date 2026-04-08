import {toModuleSliceConfigs} from "@impos2/kernel-core-interconnection";
import {screenSliceConfig} from "./screen";
import {overlaySliceConfig} from "./overlay";
import {uiVariablesSliceConfig} from "./uiVariables";

export const kernelCoreUiRuntimeSlice = {
    ...toModuleSliceConfigs(screenSliceConfig),
    ...toModuleSliceConfigs(overlaySliceConfig),
    ...toModuleSliceConfigs(uiVariablesSliceConfig),
}
