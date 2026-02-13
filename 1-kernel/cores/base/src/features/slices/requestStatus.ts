import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from "lodash";
import {
    CommandStatus,
    kernelCoreBaseState,
    LOG_TAGS,
    ModuleSliceConfig,
    RequestStatus,
    RequestStatusState,
    RequestStatusType
} from "../../types";
import {AppError, batchUpdateState, Command, logger} from "../../foundations";
import {moduleName} from "../../moduleName";


const initialState: RequestStatusState = {}
const calculateRequestStatus = (commandStatuses: CommandStatus[]): RequestStatusType => {
    const allComplete = commandStatuses.every(cs => cs.status === 'complete')
    const hasStarted = commandStatuses.some(cs => cs.status === 'started')

    if (allComplete) {
        return 'complete'
    } else if (hasStarted) {
        return 'started'
    } else {
        return 'error'
    }
}
export const slice = createSlice({
    name: kernelCoreBaseState.requestStatus,
    initialState,
    reducers: {
        commandStart: (state, action: PayloadAction<{
            actor: string,
            command: Command<any>,
            requestCleanOutTime: number
        }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `command start=>${action.payload.command.printId()}`)
            const {actor, command} = action.payload
            const request = state[command.requestId!] ?? {
                requestId: command.requestId,
                commandsStatus: {},
                errors: {},
                results: {},
                status: 'started',
                startAt: now()
            }
            request.commandsStatus[command.id] = {
                commandId: command.id,
                commandName: command.commandName,
                actorName: actor,
                requestId: command.requestId!,
                sessionId: command.sessionId,
                startAt: now(),
                status: 'started'
            }
            state[command.requestId!] = request

            Object.keys(state).filter(requestId => {
                const request = state[requestId]
                return (now() - request.updatedAt) > action.payload.requestCleanOutTime
            }).forEach(requestIdToDelete => {
                delete state[requestIdToDelete]
            })
            request.updatedAt = now()
        },
        commandComplete: (state, action: PayloadAction<{
            actor: string,
            command: Command<any>,
            result?: Record<string, any>
        }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `command complete=>${action.payload.command.printId()}`)
            const {command, result} = action.payload
            const request = state[command.requestId!]
            if (request) {
                const commandStatus = request.commandsStatus[command.id]
                if (commandStatus) {
                    commandStatus.completeAt = now()
                    commandStatus.status = 'complete'
                }
                if (result)
                    Object.assign(request.results, result)
                const commandStatuses = Object.values(request.commandsStatus)
                request.status = calculateRequestStatus(commandStatuses)
                request.updatedAt = now()
            }
        },
        commandError: (state, action: PayloadAction<{ actor: string, command: Command<any>, appError: AppError }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `command error=>${action.payload.command.printId()}`)
            const {command, appError} = action.payload
            const request = state[command.requestId!]
            if (request) {
                const commandStatus = request.commandsStatus[command.id]
                if (commandStatus) {
                    commandStatus.errorAt = now()
                    commandStatus.errorKey = appError.key
                    commandStatus.status = 'error'
                }
                request.errors[appError.key] = appError
            }
            const commandStatuses = Object.values(request.commandsStatus)
            request.status = calculateRequestStatus(commandStatuses)
            request.updatedAt = now()
        },
        batchUpdateState: (state, action: PayloadAction<Record<string, RequestStatus | undefined | null>>) => {
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreBaseState.requestStatus], 'batch update state', action.payload)
        }
    }
})

export const requestStatusActions = slice.actions

export const requestStatusConfig: ModuleSliceConfig<RequestStatusState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    stateSyncToSlave: true
}

