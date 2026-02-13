import {kernelCoreBaseState} from "../types/shared/moduleStateKey";
import {LOG_TAGS} from "../types/shared/logTags";
import  {KeyValue} from "../types/foundations/keyValue";
import {logger} from "./logger";
import {moduleName} from "../moduleName";

const allSystemParameters: Record<string, any> = {};
export const registerModuleSystemParameter = (_moduleName: string, systemParameters: DefinedSystemParameter<any>[]) => {
    systemParameters.forEach(systemParameter => {
        logger.log([moduleName, LOG_TAGS.System, "registerModuleSystemParameter"],`${_moduleName}.${systemParameter.key}:${systemParameter.name}`)
        if (Object.keys(allSystemParameters).indexOf(systemParameter.key) != -1) {
            throw new Error(`System Parameter ${systemParameter.key} has been registered`);
        }
        allSystemParameters[systemParameter.key] = systemParameter;
    })
}
export const getSystemParameterByKey = (key: string) => {
    return allSystemParameters[key];
}

export class DefinedSystemParameter<T> extends KeyValue<T> {
    constructor(
        name: string,
        key: string,
        defaultValue: T
    ) {
        super(kernelCoreBaseState.systemParameters, name, key, defaultValue);
    }
}
