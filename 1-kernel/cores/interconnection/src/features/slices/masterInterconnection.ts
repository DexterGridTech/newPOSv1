import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {MasterInterconnectionState} from "../../types/state/masterInterconnection";
import {ServerAddress, ServerConnectionStatus} from "../../types";

const initialState: MasterInterconnectionState = {
    serverConnectionStatus: ServerConnectionStatus.DISCONNECTED,
    slaveConnectionHistory: [],
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.masterInterconnection,
    initialState,
    reducers: {
        setServerAddresses: (state, action: PayloadAction<ServerAddress[]>) => {
            state.serverAddresses = action.payload
        },
        serverConnected: (state) => {
            state.serverConnectionStatus = ServerConnectionStatus.CONNECTED
        },
        serverDisconnected: (state) => {
            state.serverConnectionStatus = ServerConnectionStatus.DISCONNECTED
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