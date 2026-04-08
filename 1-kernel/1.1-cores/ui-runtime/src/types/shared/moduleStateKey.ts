import {moduleName} from "../../moduleName";
import {createModuleWorkspaceStateKeys} from "@impos2/kernel-core-interconnection";

export const kernelCoreUiRuntimeWorkspaceState = createModuleWorkspaceStateKeys(
    moduleName,
    [
        'screen',
        'overlay',
        'uiVariables'
    ] as const
)
