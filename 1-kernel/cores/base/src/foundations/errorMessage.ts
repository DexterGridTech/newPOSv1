import {kernelCoreBaseState} from "../types/shared/moduleStateKey";
import  {KeyValue} from "../types/foundations/keyValue";
import {ErrorCategory, ErrorSeverity} from "../types/shared/error";

const allErrorMessages: Record<string, DefinedErrorMessage> = {}
export const registerModuleErrorMessages = (_moduleName: string, errorMessages: DefinedErrorMessage[]) => {
    errorMessages.forEach(errorMessage => {
        if (Object.keys(allErrorMessages).indexOf(errorMessage.key) != -1) {
            throw new Error(`Error ${errorMessage.key} has been registered`);
        }
        allErrorMessages[errorMessage.key] = errorMessage;
    })
}
export const getDefinedErrorMessageByKey = (key: string) => {
    return allErrorMessages[key]
}
export class DefinedErrorMessage extends KeyValue< string > {
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;
    constructor(
        category: ErrorCategory,
        severity: ErrorSeverity,
        name: string,
        key: string,
        defaultValue: string
    ) {
        super(kernelCoreBaseState.errorMessages, name, key, defaultValue);
        this.category = category;
        this.severity = severity;
    }
}

export {ErrorCategory, ErrorSeverity};

