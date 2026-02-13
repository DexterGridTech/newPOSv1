import {kernelCoreBaseState} from "../types/shared/constants";
import {LOG_TAGS} from "../types/shared/logTags";
import type {KeyValue} from "../types/foundations/keyValue";
import {ErrorCategory, ErrorSeverity} from "../types/shared/error";
import {logger} from "./logger";
import {moduleName} from "../moduleName";

const allErrorMessages: Record<string, DefinedErrorMessage> = {}
export const registerModuleErrorMessages = (_moduleName: string, errorMessages: DefinedErrorMessage[]) => {
    errorMessages.forEach(errorMessage => {
        logger.log([moduleName, LOG_TAGS.System, "registerModuleErrors"],`${_moduleName}.${errorMessage.key}:${errorMessage.name}`)
        if (Object.keys(allErrorMessages).indexOf(errorMessage.key) != -1) {
            throw new Error(`Error ${errorMessage.key} has been registered`);
        }
        allErrorMessages[errorMessage.key] = errorMessage;
    })
}
export const getDefinedErrorMessageByKey = (key: string) => {
    return allErrorMessages[key]
}
export class DefinedErrorMessage {
    readonly stateName: string;
    readonly key: string;
    readonly name: string;
    readonly value: string;
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;

    constructor(
        category: ErrorCategory,
        severity: ErrorSeverity,
        name: string,
        key: string,
        defaultValue: string
    ) {
        this.stateName = kernelCoreBaseState.errorMessages;
        this.name = name;
        this.key = key;
        this.value = defaultValue;
        this.category = category;
        this.severity = severity;
    }
}

export {ErrorCategory, ErrorSeverity};

