import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {AppError, ICommand, registerStateToSync} from "../../core";
import {updateState} from "../utils";
import {INTERNAL} from "../../types";

export interface RequestStatus {
    commandId: string
    requestId: string
    sessionId?: string | null
    startAt: number
    completeAt?: number | null
    errorAt?: number | null
    errorMessage?: string | null
    status: "started" | "complete" | "error"
}

export interface RequestStatusState {
    [requestId: string]: { [key: string]: RequestStatus }
}

const initialState: RequestStatusState = {}

export const requestStatusSlice = createSlice({
    name: 'requestStatus',
    initialState,
    reducers: {
        commandStart: (state, action: PayloadAction<{ actor: string, command: ICommand<any> }>) => {
            const {actor, command} = action.payload
            const key = actor + '-' + command.commandName
            if (command.requestId && command.requestId != INTERNAL) {
                const request = state[command.requestId] ?? {}
                request[key] = {
                    commandId: command.id,
                    requestId: command.requestId,
                    sessionId: command.sessionId,
                    startAt: Date.now(),
                    status: 'started'
                }
                state[command.requestId] = request
            }
            Object.keys(state).filter(requestId => {
                const request = state[requestId]
                let time = 0
                Object.keys(request).forEach(key => {
                    if (request[key].startAt > time) {
                        time = request[key].startAt
                    }
                })
                return (Date.now() - time) > 360000
            }).forEach(requestIdToDelete => {
                delete state[requestIdToDelete]
            })
        },
        commandComplete: (state, action: PayloadAction<{ actor: string, command: ICommand<any> }>) => {
            const {actor, command} = action.payload
            const key = actor + '-' + command.commandName
            if (command.requestId && command.requestId != INTERNAL) {
                const request = state[command.requestId]
                if (request) {
                    const commandStatus = request[key]
                    if (commandStatus) {
                        commandStatus.completeAt = Date.now()
                        commandStatus.status = 'complete'
                    }
                }
            }
        },
        commandError: (state, action: PayloadAction<{ actor: string, command: ICommand<any>, appError: AppError }>) => {
            const {actor, command, appError} = action.payload
            const key = actor + '-' + command.commandName
            if (command.requestId && command.requestId != INTERNAL) {
                const request = state[command.requestId]
                if (request) {
                    const commandStatus = request[key]
                    if (commandStatus) {
                        commandStatus.errorAt = Date.now()
                        commandStatus.errorMessage = appError.message
                        commandStatus.status = 'error'
                    }
                }
            }
        },
        updateState: updateState
    }
})

export const requestStatusActions = requestStatusSlice.actions

registerStateToSync(requestStatusSlice.name)
