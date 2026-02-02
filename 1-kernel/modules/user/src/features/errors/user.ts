import {ErrorCategory, ErrorSeverity} from "@impos2/kernel-base";

export const UserErrors = {
    USER_ALREADY_LOGGED_IN: {
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.LOW,
        type: "user.login.already.logged.in",
        defaultMessage: "用户已登录"
    },
    USER_LOGIN_FAILED: {
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.LOW,
        type: "user.login.failed",
        defaultMessage: "用户登录失败"
    },
    USER_NOT_LOGGED_IN: {
        category: ErrorCategory.AUTHORIZATION,
        severity: ErrorSeverity.LOW,
        type: "user.login.not.logged.in",
        defaultMessage: "用户未登录"
    },
} as const;