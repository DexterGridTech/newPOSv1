import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from "lodash";
import {
    CommandStatus,
    kernelCoreBaseState,
    ModuleSliceConfig,
    RequestStatusState,
    RequestStatusType
} from "../../types";
import {AppError, batchUpdateState, ICommand} from "../../foundations";


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
        commandStart: (state, action: PayloadAction<{ actor: string, command: ICommand<any> }>) => {
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
                return (now() - request.updatedAt) > 360000
            }).forEach(requestIdToDelete => {
                delete state[requestIdToDelete]
            })
            request.updatedAt = now()
        },
        commandComplete: (state, action: PayloadAction<{
            actor: string,
            command: ICommand<any>,
            result?: Record<string, any>
        }>) => {
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
        commandError: (state, action: PayloadAction<{ actor: string, command: ICommand<any>, appError: AppError }>) => {
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
        batchUpdateState: batchUpdateState
    }
})

export const requestStatusConfig: ModuleSliceConfig<RequestStatusState, typeof slice.actions> = {
    name: slice.name,
    reducer: slice.reducer,
    actions: slice.actions,
    statePersistToStorage: false,
    stateSyncToSlave: true
}

