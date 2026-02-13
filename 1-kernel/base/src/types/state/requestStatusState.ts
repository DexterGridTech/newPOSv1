import {AppError} from "../../core/error";

export type RequestStatusType = "started" | "complete" | "error"

export interface CommandStatus {
    commandId: string
    actorName: string
    commandName: string
    requestId: string
    sessionId?: string | null
    startAt: number
    completeAt?: number | null
    errorAt?: number | null
    errorKey?: string | null
    status: RequestStatusType
}

export interface RequestStatus {
    requestId: string
    commandsStatus: { [commandId: string]: CommandStatus }
    errors: { [errorKey: string]: AppError }
    results: { [resultKey: string]: any }
    status: RequestStatusType
    startAt: number
    updatedAt: number
}

export interface RequestStatusState extends Record<string, RequestStatus> {
}
