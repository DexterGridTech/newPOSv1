import {
    deviceStatusSlice,
    instanceInfoSlice,
    masterServerStatusSlice,
    requestStatusSlice,
    slaveConnectionStatusSlice,
    systemParametersSlice,
    terminalConnectionStatusSlice,
    terminalInfoSlice,
    uiVariablesSlice,
    uiModalsSlice
} from "./slices";
import {KernelBaseStateNames} from "../types/stateNames";

export const baseModuleReducers = {
    [KernelBaseStateNames.instanceInfo]: instanceInfoSlice.reducer,
    [KernelBaseStateNames.deviceStatus]: deviceStatusSlice.reducer,
    [KernelBaseStateNames.masterServerStatus]: masterServerStatusSlice.reducer,
    [KernelBaseStateNames.slaveConnectionStatus]: slaveConnectionStatusSlice.reducer,
    [KernelBaseStateNames.systemParameters]: systemParametersSlice.reducer,
    [KernelBaseStateNames.requestStatus]: requestStatusSlice.reducer,
    [KernelBaseStateNames.terminalInfo]: terminalInfoSlice.reducer,
    [KernelBaseStateNames.terminalConnectionStatus]: terminalConnectionStatusSlice.reducer,
    [KernelBaseStateNames.uiVariables]: uiVariablesSlice.reducer,
    [KernelBaseStateNames.uiModals]: uiModalsSlice.reducer,
};