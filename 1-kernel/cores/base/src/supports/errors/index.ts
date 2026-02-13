import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "../../foundations";


export const kernelCoreBaseErrorMessages: Record<string, DefinedErrorMessage> = {
    errorMessageKeyNotExists: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        "错误信息Key未定义",
        'ERROR_MESSAGE_KEY_NOT_EXISTS',
        "错误信息Key未定义:${keysNotFound.join(',')}"
    ),
    systemParameterKeyNotExists: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        "系统参数Key未定义",
        'SYSTEM_PARAMETER_KEY_NOT_EXISTS',
        "系统参数Key未定义:${keysNotFound.join(',')}"
    )
};