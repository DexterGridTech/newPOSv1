import {LOG_TAGS, logger, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {moduleName} from "../../moduleName";
import {TerminalConnectionState} from "../../types";
import {ServerConnectionStatus, SyncType} from "@impos2/kernel-core-interconnection";
import {kernelTerminalState} from "../../types/shared/moduleStateKey";

const initialState: TerminalConnectionState = {
    serverConnectionStatus: ServerConnectionStatus.DISCONNECTED,
    connectionHistory: [],
}
const slice = createSlice({
    name: kernelTerminalState.terminalConnection,
    initialState,
    reducers: {
        connecting: (state) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'connecting')
            state.serverConnectionStatus = ServerConnectionStatus.CONNECTING
            state.connectedAt = null
            state.disconnectedAt = null
            state.connectionError = null
        },
        connected: (state) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'connected')
            state.serverConnectionStatus = ServerConnectionStatus.CONNECTED
            state.connectedAt = Date.now()
        },
        disconnected: (state, action: PayloadAction<{ connectionError: string }>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'disconnected')
            state.serverConnectionStatus = ServerConnectionStatus.DISCONNECTED
            state.disconnectedAt = Date.now()
            state.connectionError = action.payload.connectionError
            if (state.connectedAt) {
                state.connectionHistory.push({
                    connectedAt: state.connectedAt,
                    disconnectedAt: state.disconnectedAt!,
                    connectionError: state.connectionError!
                })
            }
        },
    }
})

export const terminalConnectionActions = slice.actions

export const terminalConnectionConfig: ModuleSliceConfig<TerminalConnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: false,
    syncType: SyncType.ISOLATED,
}