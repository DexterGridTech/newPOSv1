import {batchUpdateState, LOG_TAGS, logger, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {TerminalConnectionState} from "../../types";
import {ServerConnectionStatus, SyncType} from "@impos2/kernel-core-interconnection";
import {kernelCoreTerminalState} from "../../types/shared/moduleStateKey";

const initialState: TerminalConnectionState = {
    serverConnectionStatus: {
        value: ServerConnectionStatus.DISCONNECTED,
        updatedAt: 0
    },
    connectionHistory: {
        value: [],
        updatedAt: 0
    },
}
const slice = createSlice({
    name: kernelCoreTerminalState.terminalConnection,
    initialState,
    reducers: {
        connecting: (state) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'connecting')
            state.serverConnectionStatus = {
                value: ServerConnectionStatus.CONNECTING,
                updatedAt: Date.now()
            }
            state.connectedAt = {
                value: null,
                updatedAt: Date.now()
            }
            state.disconnectedAt = {
                value: null,
                updatedAt: Date.now()
            }
            state.connectionError = {
                value: null,
                updatedAt: Date.now()
            }
        },
        connected: (state) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'connected')
            state.serverConnectionStatus = {
                value: ServerConnectionStatus.CONNECTED,
                updatedAt: Date.now()
            }
            state.connectedAt = {
                value: Date.now(),
                updatedAt: Date.now()
            }
        },
        disconnected: (state, action: PayloadAction<{ connectionError: string }>) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'disconnected')
            state.serverConnectionStatus = {
                value: ServerConnectionStatus.DISCONNECTED,
                updatedAt: Date.now()
            }
            state.disconnectedAt = {
                value: Date.now(),
                updatedAt: Date.now()
            }
            state.connectionError = {
                value: action.payload.connectionError,
                updatedAt: Date.now()
            }
            if (state.connectedAt?.value) {
                state.connectionHistory= {
                    value: [{
                        connectedAt: state.connectedAt.value!,
                        disconnectedAt: state.disconnectedAt.value!,
                        connectionError: state.connectionError.value!,
                    },...state.connectionHistory.value],
                    updatedAt: Date.now()
                }
            }
        },
        batchUpdateState: (state, action) => {
            // logger.log([moduleName, LOG_TAGS.Reducer, "terminal"], 'batch update state', action.payload)
            batchUpdateState(state, action)}
    }
})

export const terminalConnectionActions = slice.actions

export const terminalConnectionConfig: ModuleSliceConfig<TerminalConnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: false,
    syncType: SyncType.MASTER_TO_SLAVE,
}