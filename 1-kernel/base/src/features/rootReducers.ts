import {
    deviceStatusSlice,
    instanceInfoSlice,
    masterServerStatusSlice,
    requestStatusSlice,
    slaveConnectionStatusSlice,
    systemParametersSlice,
    terminalConnectionStatusSlice,
    terminalInfoSlice
} from "./slices";

export const baseModuleReducers = {
    [instanceInfoSlice.name]: instanceInfoSlice.reducer,
    [deviceStatusSlice.name]: deviceStatusSlice.reducer,
    [masterServerStatusSlice.name]: masterServerStatusSlice.reducer,
    [slaveConnectionStatusSlice.name]: slaveConnectionStatusSlice.reducer,
    [systemParametersSlice.name]: systemParametersSlice.reducer,
    [requestStatusSlice.name]: requestStatusSlice.reducer,
    [terminalInfoSlice.name]: terminalInfoSlice.reducer,
    [terminalConnectionStatusSlice.name]: terminalConnectionStatusSlice.reducer,
};