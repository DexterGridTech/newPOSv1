import { PayloadAction } from "@reduxjs/toolkit";
import { InstanceModeModuleSliceConfig } from "../../foundations";
import { RequestStatusState } from "../../types/state/requestStatus";
import { AppError, Command } from "@impos2/kernel-core-base";
export declare const slice: import("../..").InstanceModeSliceResult<RequestStatusState, {
    commandStart: (state: {
        [x: string]: {
            requestId: string;
            commandsStatus: {
                [x: string]: {
                    commandId: string;
                    actorName: string;
                    commandName: string;
                    requestId: string;
                    sessionId?: string | null | undefined;
                    startAt: number;
                    completeAt?: number | null | undefined;
                    result?: {
                        [x: string]: any;
                    } | null | undefined;
                    errorAt?: number | null | undefined;
                    error?: {
                        name: string;
                        message: string;
                        key: string;
                        category: import("@impos2/kernel-core-base").ErrorCategory;
                        severity: import("@impos2/kernel-core-base").ErrorSeverity;
                        commandName?: string | undefined;
                        commandId?: string | undefined;
                        requestId?: string | undefined;
                        sessionId?: string | undefined;
                        createdAt: number;
                        stack?: string | undefined;
                    } | null | undefined;
                    status: import("../..").RequestStatusType;
                };
            };
            status: import("../..").RequestStatusType;
            startAt: number;
            updatedAt: number;
        };
    }, action: PayloadAction<{
        actor: string;
        command: Command<any>;
        requestCleanOutTime: number;
    }>) => void;
    commandComplete: (state: {
        [x: string]: {
            requestId: string;
            commandsStatus: {
                [x: string]: {
                    commandId: string;
                    actorName: string;
                    commandName: string;
                    requestId: string;
                    sessionId?: string | null | undefined;
                    startAt: number;
                    completeAt?: number | null | undefined;
                    result?: {
                        [x: string]: any;
                    } | null | undefined;
                    errorAt?: number | null | undefined;
                    error?: {
                        name: string;
                        message: string;
                        key: string;
                        category: import("@impos2/kernel-core-base").ErrorCategory;
                        severity: import("@impos2/kernel-core-base").ErrorSeverity;
                        commandName?: string | undefined;
                        commandId?: string | undefined;
                        requestId?: string | undefined;
                        sessionId?: string | undefined;
                        createdAt: number;
                        stack?: string | undefined;
                    } | null | undefined;
                    status: import("../..").RequestStatusType;
                };
            };
            status: import("../..").RequestStatusType;
            startAt: number;
            updatedAt: number;
        };
    }, action: PayloadAction<{
        actor: string;
        command: Command<any>;
        result?: Record<string, any>;
    }>) => void;
    commandError: (state: {
        [x: string]: {
            requestId: string;
            commandsStatus: {
                [x: string]: {
                    commandId: string;
                    actorName: string;
                    commandName: string;
                    requestId: string;
                    sessionId?: string | null | undefined;
                    startAt: number;
                    completeAt?: number | null | undefined;
                    result?: {
                        [x: string]: any;
                    } | null | undefined;
                    errorAt?: number | null | undefined;
                    error?: {
                        name: string;
                        message: string;
                        key: string;
                        category: import("@impos2/kernel-core-base").ErrorCategory;
                        severity: import("@impos2/kernel-core-base").ErrorSeverity;
                        commandName?: string | undefined;
                        commandId?: string | undefined;
                        requestId?: string | undefined;
                        sessionId?: string | undefined;
                        createdAt: number;
                        stack?: string | undefined;
                    } | null | undefined;
                    status: import("../..").RequestStatusType;
                };
            };
            status: import("../..").RequestStatusType;
            startAt: number;
            updatedAt: number;
        };
    }, action: PayloadAction<{
        actor: string;
        command: Command<any>;
        appError: AppError;
    }>) => void;
    batchUpdateState: (state: {
        [x: string]: {
            requestId: string;
            commandsStatus: {
                [x: string]: {
                    commandId: string;
                    actorName: string;
                    commandName: string;
                    requestId: string;
                    sessionId?: string | null | undefined;
                    startAt: number;
                    completeAt?: number | null | undefined;
                    result?: {
                        [x: string]: any;
                    } | null | undefined;
                    errorAt?: number | null | undefined;
                    error?: {
                        name: string;
                        message: string;
                        key: string;
                        category: import("@impos2/kernel-core-base").ErrorCategory;
                        severity: import("@impos2/kernel-core-base").ErrorSeverity;
                        commandName?: string | undefined;
                        commandId?: string | undefined;
                        requestId?: string | undefined;
                        sessionId?: string | undefined;
                        createdAt: number;
                        stack?: string | undefined;
                    } | null | undefined;
                    status: import("../..").RequestStatusType;
                };
            };
            status: import("../..").RequestStatusType;
            startAt: number;
            updatedAt: number;
        };
    }, action: {
        payload: any;
        type: string;
    }) => void;
}, "kernel.core.interconnection.requestStatus">;
export declare const requestStatusActions: {
    commandStart: (payload: {
        actor: string;
        command: Command<any>;
        requestCleanOutTime: number;
    }) => {
        payload: {
            actor: string;
            command: Command<any>;
            requestCleanOutTime: number;
        };
        type: string;
    };
    commandComplete: (payload: {
        actor: string;
        command: Command<any>;
        result?: Record<string, any>;
    }) => {
        payload: {
            actor: string;
            command: Command<any>;
            result?: Record<string, any>;
        };
        type: string;
    };
    commandError: (payload: {
        actor: string;
        command: Command<any>;
        appError: AppError;
    }) => {
        payload: {
            actor: string;
            command: Command<any>;
            appError: AppError;
        };
        type: string;
    };
    batchUpdateState: (payload: any) => {
        payload: any;
        type: string;
    };
};
export declare const requestStatusConfig: InstanceModeModuleSliceConfig<RequestStatusState>;
//# sourceMappingURL=requestStatus.d.ts.map