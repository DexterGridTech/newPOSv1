import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "./errorMessages";
import type {IAppError} from "../types/shared/error";
import {APIResponseCode, ResponseWrapper} from "../types";

interface ICommandLike {
    id?: string;
    commandName?: string;
    requestId?: string;
    sessionId?: string;
}

export const getErrorMessageText = {
    getErrorMessage: (definedError: DefinedErrorMessage, args?: any): string => {
        const message = definedError.value
        if (args) {
            return message.replace(/\$\{([\s\S]+?)\}/g, (_, key) => args[key.trim()] ?? '');
        } else
            return message
    }
}


export class AppError extends Error implements IAppError {
    public readonly category: ErrorCategory;
    public readonly severity: ErrorSeverity;
    public readonly key: string;
    commandName?: string;
    commandId?: string;
    requestId?: string;
    sessionId?: string;
    public readonly createdAt: number;

    constructor(definedError: DefinedErrorMessage, args?: any, command?: ICommandLike) {
        super(getErrorMessageText.getErrorMessage(definedError, args));
        this.name = this.constructor.name;
        this.category = definedError.category || ErrorCategory.UNKNOWN;
        this.severity = definedError.severity || ErrorSeverity.MEDIUM;
        this.key = definedError.key || 'ERR_UNKNOWN';
        this.createdAt = Date.now();
        this.commandId = command?.id
        this.commandName = command?.commandName
        this.requestId = command?.requestId
        this.sessionId = command?.sessionId

        // 保持正确的原型链
        Object.setPrototypeOf(this, new.target.prototype);
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.key,
            category: this.category,
            severity: this.severity,
            stack: this.stack
        };
    }
}

export class APIError extends AppError {
    constructor(responseWrapper: ResponseWrapper<any>, extraMessage?: string, command?: ICommandLike) {
        let definedErrorInfo: DefinedErrorMessage
        if (Object.values(APIResponseCode).includes(responseWrapper.code as APIResponseCode)) {
            definedErrorInfo = new DefinedErrorMessage(
                ErrorCategory.NETWORK,
                ErrorSeverity.MEDIUM,
                "网络错误",
                'server.network.error',
                `网络错误 ${responseWrapper.message}`
            )
        } else {
            definedErrorInfo = new DefinedErrorMessage(
                ErrorCategory.BUSINESS,
                ErrorSeverity.LOW,
                "业务逻辑错误",
                'server.business.error',
                `${responseWrapper.message}`
            )
        }
        super(definedErrorInfo, extraMessage, command);
        // 保持正确的原型链
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}