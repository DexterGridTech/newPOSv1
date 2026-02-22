import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelCoreNavigationErrorMessages = {
    navigationError: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "导航错误",
        'navigation.error',
        "导航错误:${reasons.join(',')}"
    )
};