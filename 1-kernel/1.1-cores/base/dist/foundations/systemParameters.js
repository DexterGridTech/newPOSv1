import { kernelCoreBaseState } from "../types/shared/moduleStateKey";
import { KeyValue } from "../types/foundations/keyValue";
const allSystemParameters = {};
export const registerModuleSystemParameter = (_moduleName, systemParameters) => {
    systemParameters.forEach(systemParameter => {
        if (Object.keys(allSystemParameters).indexOf(systemParameter.key) != -1) {
            throw new Error(`System Parameter ${systemParameter.key} has been registered`);
        }
        allSystemParameters[systemParameter.key] = systemParameter;
    });
};
export const getSystemParameterByKey = (key) => {
    return allSystemParameters[key];
};
export class DefinedSystemParameter extends KeyValue {
    constructor(name, key, defaultValue) {
        super(kernelCoreBaseState.systemParameters, name, key, defaultValue);
    }
}
