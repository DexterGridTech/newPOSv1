import {kernelCoreBaseState} from "../types/shared/moduleStateKey";
import {LOG_TAGS} from "../types/shared/logTags";
import  {KeyValue} from "../types/foundations/keyValue";
import {ErrorCategory, ErrorSeverity} from "../types/shared/error";
import {logger} from "./logger";
import {moduleName} from "../moduleName";

const allErrorMessages: Record<string, DefinedErrorMessage> = {}
export const registerModuleErrorMessages = (_moduleName: string, errorMessages: DefinedErrorMessage[]) => {
    errorMessages.forEach(errorMessage => {
        logger.log([moduleName, LOG_TAGS.System, "registerModuleErrorMessages"],`${_moduleName}.${errorMessage.key}:${errorMessage.name}`)
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

