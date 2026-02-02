import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {DeviceInfo, SystemStatus} from "../../types";

export interface DeviceStatusState {
    deviceInfo: DeviceInfo | null;
    systemStatus?: SystemStatus | null
}
const initialState: DeviceStatusState = {
    deviceInfo: null
}

export const deviceStatusSlice = createSlice({
    name: 'deviceStatus',
    initialState,
    reducers: {
        setSystemStatus: (state, action: PayloadAction<SystemStatus>) => {
            state.systemStatus = action.payload
        },
    }
})

export const deviceStatusActions = deviceStatusSlice.actions
