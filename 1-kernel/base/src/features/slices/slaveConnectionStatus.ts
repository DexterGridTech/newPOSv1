import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ServerConnectionStatus} from "../../types";

export interface SlaveConnectionStatusState {
    masterServerConnectionStatus?: ServerConnectionStatus
}

const initialState: SlaveConnectionStatusState = {}

export const slaveConnectionStatusSlice = createSlice({
    name: 'slaveConnectionStatus',
    initialState,
    reducers: {
        setMasterServerConnectionStatus: (state, action: PayloadAction<ServerConnectionStatus>) => {
            state.masterServerConnectionStatus = action.payload
        }
    }
})

export const slaveConnectionStatusActions = slaveConnectionStatusSlice.actions