import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";

export const kernelCoreUiRuntimeErrorMessages = {
    uiRuntimeError: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        "UI运行时错误",
        'ui-runtime.error',
        "UI运行时错误:${reasons}"
    )
};
