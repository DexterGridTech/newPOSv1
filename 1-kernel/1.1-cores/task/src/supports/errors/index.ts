import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const kernelCoreTaskErrorMessages = {
    keyIsNotRight: new DefinedErrorMessage(
        ErrorCategory.AUTHORIZATION,
        ErrorSeverity.HIGH,
        "key is not right",
        "keyIsNotRight",
        "钥匙不对，无法开门"
    )
};