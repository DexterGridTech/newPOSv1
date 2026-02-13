import {ModuleSliceConfig} from "@impos2/kernel-core-base";
import {createSlice} from "@reduxjs/toolkit";
import {kernelCoreInterconnectionState} from "../../types/shared/moduleStateKey";
import {SlaveInterconnectionState} from "../../types/state/slaveInterconnection";
import {ServerConnectionStatus} from "../../types/shared/connection";

const initialState: SlaveInterconnectionState = {
    connectionStatus: ServerConnectionStatus.DISCONNECTED
}
const slice = createSlice({
    name: kernelCoreInterconnectionState.slaveInterconnection,
    initialState,
    reducers: {}
})

export const slaveInterconnectionActions = slice.actions

export const slaveInterconnectionConfig: ModuleSliceConfig<SlaveInterconnectionState> = {
    name: slice.name,
    reducer: slice.reducer,
    statePersistToStorage: false,
    stateSyncToSlave: false
}