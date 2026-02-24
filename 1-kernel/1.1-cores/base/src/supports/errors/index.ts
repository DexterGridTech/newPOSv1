import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "../../foundations";


export const kernelCoreBaseErrorMessages = {
    errorMessageKeyNotExists: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        "错误信息Key未定义",
        'error.message.key.not.exists',
        "错误信息Key未定义:${keysNotFound}"
    ),
    systemParameterKeyNotExists: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        "系统参数Key未定义",
        'system.parameter.key.not.exists',
        "系统参数Key未定义:${keysNotFound}"
    )
};