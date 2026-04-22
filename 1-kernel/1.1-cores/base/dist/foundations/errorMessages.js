import { kernelCoreBaseState } from "../types/shared/moduleStateKey";
import { KeyValue } from "../types/foundations/keyValue";
import { ErrorCategory, ErrorSeverity } from "../types/shared/error";
const allErrorMessages = {};
export const registerModuleErrorMessages = (_moduleName, errorMessages) => {
    errorMessages.forEach(errorMessage => {
        if (Object.keys(allErrorMessages).indexOf(errorMessage.key) != -1) {
            throw new Error(`Error ${errorMessage.key} has been registered`);
        }
        allErrorMessages[errorMessage.key] = errorMessage;
    });
};
export const getDefinedErrorMessageByKey = (key) => {
    return allErrorMessages[key];
};
export class DefinedErrorMessage extends KeyValue {
    category;
    severity;
    constructor(category, severity, name, key, defaultValue) {
        super(kernelCoreBaseState.errorMessages, name, key, defaultValue);
        this.category = category;
        this.severity = severity;
    }
}
export { ErrorCategory, ErrorSeverity };
