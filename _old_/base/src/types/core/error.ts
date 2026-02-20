export interface DefinedErrorInfo {
    category: ErrorCategory;
    severity: ErrorSeverity;
    key: string
    defaultMessage: string
}

export const errorMessageTextGetter = {
    getErrorMessage: (definedError: DefinedErrorInfo, extraMessage?: string): string => {
        return definedError.defaultMessage + (extraMessage ? (":" + extraMessage) : "")
    }
}

export enum ErrorCategory {
    BUSINESS = 'BUSINESS',           // 业务逻辑错误
    VALIDATION = 'VALIDATION',       // 数据验证错误
    AUTHENTICATION = 'AUTHENTICATION', // 认证错误
    AUTHORIZATION = 'AUTHORIZATION',   // 授权错误
    NETWORK = 'NETWORK',              // 网络错误
    DATABASE = 'DATABASE',            // 数据库错误
    EXTERNAL_API = 'EXTERNAL_API',    // 外部API错误
    SYSTEM = 'SYSTEM',                // 系统错误
    UNKNOWN = 'UNKNOWN'               // 未知错误
}

export enum ErrorSeverity {
    LOW = 'LOW',       // 低优先级，可忽略
    MEDIUM = 'MEDIUM', // 中优先级，需要关注
    HIGH = 'HIGH',     // 高优先级，需要立即处理
    CRITICAL = 'CRITICAL' // 严重错误，影响核心功能
}

