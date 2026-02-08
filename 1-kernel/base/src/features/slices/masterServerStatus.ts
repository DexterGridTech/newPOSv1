import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {now} from 'lodash';

import {ServerAddress, ServerConnectionStatus, SlaveConnection} from "../../types";
import {KernelBaseStateNames} from "../../types/stateNames";
import {MasterServerStatusState} from "../../types/state";

export type {MasterServerStatusState}
const initialState: MasterServerStatusState = {}

export const masterServerStatusSlice = createSlice({
    name: KernelBaseStateNames.masterServerStatus,
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
            action.payload.connectedAt = now()
            state.slaveConnection[action.payload.slaveName] = action.payload
        },
        slaveDisconnected: (state, action: PayloadAction<SlaveConnection>) => {
            if (state.slaveConnection) {
                const connection = state.slaveConnection[action.payload.slaveName]
                if (connection) {
                    connection.disconnectedAt = now()
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
