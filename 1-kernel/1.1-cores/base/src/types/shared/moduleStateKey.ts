
import {moduleName} from "../../moduleName";
import {createModuleStateKeys} from "./createModuleStateKeys";
export const kernelCoreBaseState = createModuleStateKeys(
    moduleName,
    [
        'errorMessages',
        'systemParameters'
    ] as const
);
