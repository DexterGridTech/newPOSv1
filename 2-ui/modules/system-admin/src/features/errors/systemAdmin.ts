import {ErrorCategory, ErrorSeverity} from "@impos2/kernel-base";

export const SystemAdminErrors = {
    ADMIN_LOGIN_FAILED: {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        key: "admin.login.failed",
        defaultMessage: "密码错误，请重试"
    },
} as const;