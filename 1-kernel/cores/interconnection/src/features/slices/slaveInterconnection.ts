import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {SlaveInterconnectionState} from "../../types/state/slaveInterconnection";
import {ServerConnectionStatus} from "../../types/shared/connection";

const initialState: SlaveInterconnectionState = {
    serverConnectionStatus: ServerConnectionStatus.DISCONNECTED,
    connectionHistory: [],
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.slaveInterconnection,
    initialState,
    reducers: {
        connecting: (state) => {
            state.serverConnectionStatus = ServerConnectionStatus.CONNECTING
            state.connectedAt = null
            state.disconnectedAt = null
            state.connectionError = null
        },
        connected: (state) => {
            state.serverConnectionStatus = ServerConnectionStatus.CONNECTED
            state.connectedAt = Date.now()
        },
        disconnected: (state,action:PayloadAction<{connectionError:string}>) => {
            state.serverConnectionStatus = ServerConnectionStatus.DISCONNECTED
            state.disconnectedAt = Date.now()
            state.connectionError = action.payload.connectionError
            state.connectionHistory.push({
                connectedAt: state.connectedAt!,
                disconnectedAt: state.disconnectedAt!,
                connectionError: state.connectionError!
            })
        },
    }
})

export const slaveInterconnectionActions = slice.actions

export const slaveInterconnectionConfig: ModuleSliceConfig<SlaveInterconnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    stateSyncToSlave: false
}