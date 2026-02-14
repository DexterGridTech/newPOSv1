
import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "./createModuleStateKeys";
export const kernelCoreBaseState = createModuleStateKeys(
    moduleName,
    [
        'requestStatus',
        'errorMessages',
        'systemParameters'
    ] as const
);
