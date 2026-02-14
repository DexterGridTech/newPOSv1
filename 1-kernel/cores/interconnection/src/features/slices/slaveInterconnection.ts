import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {SlaveInterconnectionState} from "../../types/state/slaveInterconnection";
import {ServerConnectionStatus} from "../../types/shared/connection";

const initialState: SlaveInterconnectionState = {
    connectionStatus: ServerConnectionStatus.DISCONNECTED,
    connectionHistory: [],
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.slaveInterconnection,
    initialState,
    reducers: {
        connected: (state) => {
            state.connectionStatus = ServerConnectionStatus.CONNECTED
            state.connectedAt = Date.now()
        },
        disconnected: (state,action:PayloadAction<{connectionError:string}>) => {
            state.connectionStatus = ServerConnectionStatus.DISCONNECTED
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