import type {IAppError} from "../shared/error";

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
    commandsStatus: Record<string, CommandStatus>
    errors: Record<string, IAppError>
    results: Record<string, any>
    status: RequestStatusType
    startAt: number
    updatedAt: number
}

export interface RequestStatusState extends Record<string, RequestStatus>{
}
