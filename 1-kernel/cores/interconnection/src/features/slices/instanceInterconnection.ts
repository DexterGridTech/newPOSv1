import {LOG_TAGS, logger, ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {InstanceInterconnectionState, ServerConnectionStatus} from "../../types";
import {SyncType} from "../../types/shared/syncType";
import {moduleName} from "../../moduleName";

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
            state.startToSync = false
            if (state.connectedAt) {
                state.connectionHistory.push({
                    connectedAt: state.connectedAt,
                    disconnectedAt: state.disconnectedAt!,
                    connectionError: state.connectionError!
                })
            }
        },
        startToSync: (state) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'startToSync')
            state.startToSync = true
        },
        slaveConnected: (state, action: PayloadAction<string>) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'slaveConnected',action.payload)
            state.master.slaveConnection = {
                deviceId: action.payload,
                connectedAt: Date.now()
            }
        },
        slaveDisconnected: (state) => {
            logger.log([moduleName, LOG_TAGS.Reducer, "instanceInterconnection"], 'slaveDisconnected')
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