import { DefinedErrorMessage, ErrorCategory, ErrorSeverity } from "./errorMessages";
import type { IAppError } from "../types/shared/error";
import { ResponseWrapper } from "../types";
interface ICommandLike {
    id?: string;
    commandName?: string;
    requestId?: string;
    sessionId?: string;
}
export declare const getErrorMessageText: {
    getErrorMessage: (definedError: DefinedErrorMessage, args?: any) => string;
};
export declare class AppError extends Error implements IAppError {
    readonly category: ErrorCategory;
    readonly severity: ErrorSeverity;
    readonly key: string;
    commandName?: string;
    commandId?: string;
    requestId?: string;
    sessionId?: string;
    readonly createdAt: number;
    constructor(definedError: DefinedErrorMessage, args?: any, command?: ICommandLike);
    toJSON(): {
        name: string;
        message: string;
        type: string;
        category: ErrorCategory;
        severity: ErrorSeverity;
        stack: string | undefined;
    };
}
export declare class APIError extends AppError {
    constructor(responseWrapper: ResponseWrapper<any>, extraMessage?: string, command?: ICommandLike);
}
export {};
//# sourceMappingURL=error.d.ts.map