import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInterconnectionState} from "../../types/state/masterInterconnection";
import {ServerConnectionStatus} from "../../types";

const initialState: MasterInterconnectionState = {
    serverConnectionStatus: ServerConnectionStatus.DISCONNECTED,
    slaveConnectionHistory: [],
    connectionHistory: []
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.masterInterconnection,
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
        slaveConnected: (state, action: PayloadAction<{ name: string, deviceId: string }>) => {
            state.slaveConnection = {
                name: action.payload.name,
                deviceId: action.payload.deviceId,
                connectedAt: Date.now()
            }
        },
        slaveDisconnected: (state) => {
            if (state.slaveConnection) {
                state.slaveConnection = {
                    ...state.slaveConnection!,
                    disconnectedAt: Date.now()
                }
                state.slaveConnectionHistory.push(state.slaveConnection)
            }
        }
    }
})

export const masterInterconnectionActions = slice.actions

export const masterInterconnectionConfig: ModuleSliceConfig<MasterInterconnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    stateSyncToSlave: false
}