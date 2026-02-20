import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ServerConnectionStatus} from "../../types";
import {KernelBaseStateNames} from "../../types/stateNames";
import {SlaveConnectionStatusState} from "../../types/state";

export type {SlaveConnectionStatusState}

const initialState: SlaveConnectionStatusState = {}

export const slaveConnectionStatusSlice = createSlice({
    name: KernelBaseStateNames.slaveConnectionStatus,
    initialState,
    reducers: {
        setMasterServerConnectionStatus: (state, action: PayloadAction<ServerConnectionStatus>) => {
            state.masterServerConnectionStatus = action.payload
        }
    }
})

export const slaveConnectionStatusActions = slaveConnectionStatusSlice.actions