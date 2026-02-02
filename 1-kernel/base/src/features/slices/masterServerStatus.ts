import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ServerAddress, ServerConnectionStatus, SlaveConnection} from "../../types";

export interface MasterServerStatusState {
    serverAddresses?:ServerAddress[]
    serverConnectionStatus?:ServerConnectionStatus
    slaveConnection?:{[name:string]:SlaveConnection}
    slaveConnectionHistory?:{[name:string]:SlaveConnection[]}
}
const initialState: MasterServerStatusState = {}

export const masterServerStatusSlice = createSlice({
    name: 'masterServerStatus',
    initialState,
    reducers: {
        setMasterServerAddresses: (state, action: PayloadAction<ServerAddress[]>) => {
            state.serverAddresses = action.payload
        },
        setMasterServerConnectionStatus: (state, action: PayloadAction<ServerConnectionStatus>) => {
            state.serverConnectionStatus = action.payload
        },
        slaveConnected: (state, action: PayloadAction<SlaveConnection>) => {
            if (!state.slaveConnection) {
                state.slaveConnection = {}
            }
            action.payload.connectedAt = Date.now()
            state.slaveConnection[action.payload.slaveName] = action.payload
        },
        slaveDisconnected: (state, action: PayloadAction<SlaveConnection>) => {
            if (state.slaveConnection) {
                const connection = state.slaveConnection[action.payload.slaveName]
                if (connection) {
                    connection.disconnectedAt = Date.now()
                }
                delete state.slaveConnection[action.payload.slaveName]

                if (!state.slaveConnectionHistory) {
                    state.slaveConnectionHistory = {}
                }
                const connectionHistory = state.slaveConnectionHistory[action.payload.slaveName] ?? []
                connectionHistory.push(connection)
                state.slaveConnectionHistory[action.payload.slaveName] = connectionHistory
            }
        }
    }
})

export const masterServerStatusActions = masterServerStatusSlice.actions
