import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "@impos2/kernel-core-base";


export const uiAdminErrorMessages = {
    adminLoginFailed: new DefinedErrorMessage(
        ErrorCategory.VALIDATION,
        ErrorSeverity.MEDIUM,
        "管理员登录失败",
        'error.message.admin.login.failed',
        "管理员登录失败"
    )
};