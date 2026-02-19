import {PayloadAction} from "@reduxjs/toolkit";
import {InstanceMode, kernelCoreInterconnectionInstanceState} from "../../types";
import {createInstanceModeSlice, InstanceModeModuleSliceConfig} from "../../foundations";
import {moduleName} from "../../moduleName";
import {SyncType} from "../../types/shared/syncType";
import {RequestStatus, RequestStatusState} from "../../types/state/requestStatus";
import {AppError, batchUpdateState, Command, LOG_TAGS, logger} from "@impos2/kernel-core-base-v1";


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
export const slice = createInstanceModeSlice(
    kernelCoreInterconnectionInstanceState.requestStatus,
    initialState,
    {
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
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], `保存命令结束=>${action.payload.command.printId()}`)
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
        batchUpdateState: (state, action) => {
            batchUpdateState(state, action)
            logger.log([moduleName, LOG_TAGS.Reducer, "requestStatus"], action.type, action.payload)
        }
    }
)

export const requestStatusActions = slice.actions

export const requestStatusConfig: InstanceModeModuleSliceConfig<RequestStatusState> = {
    name: slice.name,
    reducers: slice.reducers,
    persistToStorage: false,
    syncType: {
        [InstanceMode.MASTER]: SyncType.MASTER_TO_SLAVE,
        [InstanceMode.SLAVE]: SyncType.SLAVE_TO_MASTER
    }
}

