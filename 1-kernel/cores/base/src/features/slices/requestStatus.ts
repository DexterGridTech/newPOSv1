import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreBaseState, LOG_TAGS, ModuleSliceConfig, RequestStatus, RequestStatusState} from "../../types";
import {AppError, Command, logger} from "../../foundations";
import {moduleName} from "../../moduleName";


const initialState: RequestStatusState = {}
const updateRequestStatus = (request: RequestStatus) => {
    const commandStatuses = Object.values(request.commandsStatus)
    const hasError = commandStatuses.some(cs => cs.status === 'error')
    const allComplete = commandStatuses.every(cs => cs.status === 'complete')
    request.status = hasError ? 'error' : allComplete ? 'complete' : 'started'
    request.updateAt = commandStatuses.reduce((latest, cs) => {
        const time = cs.completeAt ?? cs.errorAt ?? 0
        return time > latest ? time : latest
    }, 0)
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
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `保存命令开始=>${action.payload.command.printId()}`)
            const {actor, command, requestCleanOutTime} = action.payload
            const requestId = command.requestId!
            const request = state[requestId] ?? {
                requestId: requestId,
                commandsStatus: {},
                errors: {},
                results: {},
                status: 'started',
                startAt: Date.now()
            }
            request.commandsStatus[`${actor}-${command.id}`] = {
                commandId: command.id,
                commandName: command.commandName,
                actorName: actor,
                requestId: requestId,
                sessionId: command.sessionId,
                startAt: Date.now(),
                status: 'started'
            }
            state[requestId] = request

            Object.keys(state).filter(requestId => {
                const request = state[requestId]
                return (Date.now() - request.updateAt) > requestCleanOutTime
            }).forEach(requestIdToDelete => {
                delete state[requestIdToDelete]
            })
            request.updateAt = Date.now()
        },
        commandComplete: (state, action: PayloadAction<{
            actor: string,
            command: Command<any>,
            result?: Record<string, any>
        }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `保持命令结束=>${action.payload.command.printId()}`)
            const {actor, command, result} = action.payload
            const request = state[command.requestId!]
            if (request) {
                const commandStatus = request.commandsStatus[`${actor}-${command.id}`]
                if (commandStatus) {
                    commandStatus.completeAt = Date.now()
                    commandStatus.result = result
                    commandStatus.status = 'complete'
                }
                updateRequestStatus(request)
            }
        },
        commandError: (state, action: PayloadAction<{ actor: string, command: Command<any>, appError: AppError }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `保存命令错误=>${action.payload.command.printId()}`)
            const {actor, command, appError} = action.payload
            const request = state[command.requestId!]
            if (request) {
                const commandStatus = request.commandsStatus[`${actor}-${command.id}`]
                if (commandStatus) {
                    commandStatus.errorAt = Date.now()
                    commandStatus.error = appError
                    commandStatus.status = 'error'
                }
            }
            updateRequestStatus(request)
        },
        //stateSyncToSlave: true的时候，必须有batchUpdateState方法
        batchUpdateState: (state, action: PayloadAction<Record<string, RequestStatus | undefined | null>>) => {
            Object.keys(action.payload).forEach(key => {
                const currentRequest = state[key]
                const newRequest = action.payload[key]
                if (currentRequest && newRequest) {
                    Object.keys(newRequest.commandsStatus).forEach(k => {
                        currentRequest.commandsStatus[k] = newRequest.commandsStatus[k]
                    })
                    updateRequestStatus(currentRequest)
                }
            })
            logger.log([moduleName, LOG_TAGS.Reducer, kernelCoreBaseState.requestStatus], 'batch update state', action.payload)
        }
    }
})

export const requestStatusActions = slice.actions

export const requestStatusConfig: ModuleSliceConfig<RequestStatusState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    //如果stateSyncToSlave=true,state的属性需集成{updateAt:number}才能被同步
    stateSyncToSlave: true
}

