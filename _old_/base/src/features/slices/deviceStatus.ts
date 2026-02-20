import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {DeviceInfo, SystemStatus} from "../../types";
import {KernelBaseStateNames} from "../../types/stateNames";
import {DeviceStatusState} from "../../types/state";

export type {DeviceStatusState}
const initialState: DeviceStatusState = {
    deviceInfo: null
}

export const deviceStatusSlice = createSlice({
    name: KernelBaseStateNames.deviceStatus,
    initialState,
    reducers: {
        setSystemStatus: (state, action: PayloadAction<SystemStatus>) => {
            state.systemStatus = action.payload
        },
    }
})

export const deviceStatusActions = deviceStatusSlice.actions
