import {
    APIErrorCode,
    DefinedErrorInfo,
    ErrorCategory,
    errorMessageTextGetter,
    ErrorSeverity,
    ResponseWrapper
} from "../types";

/**
 * Command 最小接口定义，避免循环依赖
 */
interface ICommandLike {
    id?: string;
    commandName?: string;
    requestId?: string;
    sessionId?: string;
}

export class AppError extends Error {
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly type: string;
    commandId?: string;
    commandName?: string;
    requestId?: string;
    sessionId?: string;
    public readonly createdAt: number;

    constructor(definedError: DefinedErrorInfo, extraMessage?: string, command?: ICommandLike) {
        super(errorMessageTextGetter.getErrorMessage(definedError, extraMessage));
        this.name = this.constructor.name;
        this.category = definedError.category || ErrorCategory.UNKNOWN;
        this.severity = definedError.severity || ErrorSeverity.MEDIUM;
        this.type = definedError.type || 'ERR_UNKNOWN';
        this.createdAt = Date.now();
        this.commandId = command?.id
        this.commandName = command?.commandName
        this.requestId = command?.requestId
        this.sessionId = command?.sessionId

        // 保持正确的原型链
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            category: this.category,
            severity: this.severity,
            stack: this.stack
        };
    }
}

export class APIError extends AppError {
    constructor(responseWrapper: ResponseWrapper<any>, extraMessage?: string, command?: ICommandLike) {
        let definedErrorInfo: DefinedErrorInfo
        if (Object.values(APIErrorCode).includes(responseWrapper.code as APIErrorCode)) {
            definedErrorInfo = {
                category: ErrorCategory.NETWORK,
                severity: ErrorSeverity.MEDIUM,
                type: "API_NETWORK_ERROR",
                defaultMessage: "网络错误:" + responseWrapper.message
            }
        } else {
            definedErrorInfo = {
                category: ErrorCategory.BUSINESS,
                severity: ErrorSeverity.LOW,
                type: "SERVER_BUSINESS_ERROR",
                defaultMessage: responseWrapper.message ?? "业务逻辑错误"
            }
        }
        super(definedErrorInfo, extraMessage, command);
        // 保持正确的原型链
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}