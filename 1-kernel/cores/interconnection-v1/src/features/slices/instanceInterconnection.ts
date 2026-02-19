import {ModuleSliceConfig} from "@impos2/kernel-core-base-v1";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {InstanceInterconnectionState, ServerConnectionStatus} from "../../types";
import {SyncType} from "../../types/shared/syncType";

const initialState: InstanceInterconnectionState = {
    serverConnectionStatus: ServerConnectionStatus.DISCONNECTED,
    connectionHistory: [],
    startToSync: false,
    master:{
        slaveConnectionHistory: [],
    }
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.instanceInterconnection,
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
        disconnected: (state, action: PayloadAction<{ connectionError: string }>) => {
            state.serverConnectionStatus = ServerConnectionStatus.DISCONNECTED
            state.disconnectedAt = Date.now()
            state.connectionError = action.payload.connectionError
            state.startToSync = false
            state.connectionHistory.push({
                connectedAt: state.connectedAt!,
                disconnectedAt: state.disconnectedAt!,
                connectionError: state.connectionError!
            })
        },
        startToSync: (state) => {
            state.startToSync = true
        },
        slaveConnected: (state, action: PayloadAction<string>) => {
            state.master.slaveConnection = {
                deviceId: action.payload,
                connectedAt: Date.now()
            }
        },
        slaveDisconnected: (state) => {
            if (state.master.slaveConnection) {
                state.master.slaveConnection = {
                    ...state.master.slaveConnection!,
                    disconnectedAt: Date.now()
                }
                state.master.slaveConnectionHistory.push(state.master.slaveConnection)
            }
            state.startToSync = false
        }
    }
})

export const instanceInterconnectionActions = slice.actions

export const instanceInterconnectionConfig: ModuleSliceConfig<InstanceInterconnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    persistToStorage: false,
    syncType: SyncType.ISOLATED,
}