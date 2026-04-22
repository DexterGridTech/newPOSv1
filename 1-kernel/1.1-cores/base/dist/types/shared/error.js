/**
 * 错误类别枚举
 */
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["BUSINESS"] = "BUSINESS";
    ErrorCategory["VALIDATION"] = "VALIDATION";
    ErrorCategory["AUTHENTICATION"] = "AUTHENTICATION";
    ErrorCategory["AUTHORIZATION"] = "AUTHORIZATION";
    ErrorCategory["NETWORK"] = "NETWORK";
    ErrorCategory["DATABASE"] = "DATABASE";
    ErrorCategory["EXTERNAL_API"] = "EXTERNAL_API";
    ErrorCategory["SYSTEM"] = "SYSTEM";
    ErrorCategory["UNKNOWN"] = "UNKNOWN"; // 未知错误
})(ErrorCategory || (ErrorCategory = {}));
/**
 * 错误严重程度枚举
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "LOW";
    ErrorSeverity["MEDIUM"] = "MEDIUM";
    ErrorSeverity["HIGH"] = "HIGH";
    ErrorSeverity["CRITICAL"] = "CRITICAL"; // 严重错误，影响核心功能
})(ErrorSeverity || (ErrorSeverity = {}));
