import _, {now} from 'lodash';
import {DefinedErrorMessage, ErrorCategory, ErrorSeverity} from "./errorMessage";
import type {IAppError} from "../types/shared/error";

interface ICommandLike {
    id?: string;
    commandName?: string;
    requestId?: string;
    sessionId?: string;
}

export const errorMessageTextGetter = {
    getErrorMessage: (definedError: DefinedErrorMessage, args?: any): string => {
        const message = definedError.value
        if (args) {
            const compiled = _.template(message, {interpolate: /\$\{([\s\S]+?)\}/g});
            return compiled(args);
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
        super(errorMessageTextGetter.getErrorMessage(definedError, args));
        this.name = this.constructor.name;
        this.category = definedError.category || ErrorCategory.UNKNOWN;
        this.severity = definedError.severity || ErrorSeverity.MEDIUM;
        this.key = definedError.key || 'ERR_UNKNOWN';
        this.createdAt = now();
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
            type: this.key,
            category: this.category,
            severity: this.severity,
            stack: this.stack
        };
    }
}

// export class APIError extends AppError {
//     constructor(responseWrapper: ResponseWrapper<any>, extraMessage?: string, command?: ICommandLike) {
//         let definedErrorInfo: DefinedErrorInfo
//         if (Object.values(APIErrorCode).includes(responseWrapper.code as APIErrorCode)) {
//             definedErrorInfo = {
//                 category: ErrorCategory.NETWORK,
//                 severity: ErrorSeverity.MEDIUM,
//                 key: "API_NETWORK_ERROR",
//                 defaultMessage: "网络错误:" + responseWrapper.message
//             }
//         } else {
//             definedErrorInfo = {
//                 category: ErrorCategory.BUSINESS,
//                 severity: ErrorSeverity.LOW,
//                 key: "SERVER_BUSINESS_ERROR",
//                 defaultMessage: responseWrapper.message ?? "业务逻辑错误"
//             }
//         }
//         super(definedErrorInfo, extraMessage, command);
//         // 保持正确的原型链
//         Object.setPrototypeOf(this, new.target.prototype);
//         Error.captureStackTrace(this, this.constructor);
//     }
// }