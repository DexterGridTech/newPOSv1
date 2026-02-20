import {IAppError} from "@impos2/kernel-core-base";

export type RequestStatusType = "started" | "complete" | "error"

export interface CommandStatus {
    commandId: string
    actorName: string
    commandName: string
    requestId: string
    sessionId?: string | null
    startAt: number
    completeAt?: number | null
    result?: Record<string, any> | null
    errorAt?: number | null
    error?: IAppError | null
    status: RequestStatusType
}

export interface RequestStatus {
    requestId: string
    commandsStatus: Record<string, CommandStatus>
    status: RequestStatusType
    startAt: number
    updateAt: number
}

export interface RequestStatusState extends Record<string, RequestStatus>{
}
