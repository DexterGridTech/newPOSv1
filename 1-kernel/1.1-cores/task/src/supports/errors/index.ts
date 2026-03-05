import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelCoreTaskErrorMessages = {
    keyIsNotRight: new DefinedErrorMessage(
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
        "key is not right",
        "keyIsNotRight",
        "钥匙不对，无法开门"
    ),

    taskExecutionError: new DefinedErrorMessage(
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        "task execution error",
        "taskExecutionError",
        "任务执行错误"
    )
};