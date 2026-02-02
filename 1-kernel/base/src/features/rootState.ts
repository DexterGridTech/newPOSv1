import {UnitDataState} from "../types";
import {
    requestStatusSlice,
    RequestStatusState, deviceStatusSlice,
    DeviceStatusState, instanceInfoSlice,
    InstanceInfoState, masterServerStatusSlice,
    MasterServerStatusState, slaveConnectionStatusSlice,
    SlaveConnectionStatusState, systemParametersSlice, SystemParametersState, terminalConnectionStatusSlice,
    TerminalConnectionStatusState, terminalInfoSlice,
    TerminalInfoState
} from "./slices";
import {PayloadAction} from "@reduxjs/toolkit";
import {Epic} from "redux-observable";
import {PersistPartial} from 'redux-persist/es/persistReducer';

export const UDG_ErrorMessages = 'UDG_ErrorMessages'
export const UDG_SystemParameters = 'UDG_SystemParameters'

export interface UnitDataGroupStates {
    UDG_ErrorMessages: UnitDataState
    UDG_SystemParameters: UnitDataState
}

export const unitDataGroups = new Set<keyof UnitDataGroupStates>()
unitDataGroups.add(UDG_ErrorMessages)
unitDataGroups.add(UDG_SystemParameters)

export interface RootStateBase {
    [instanceInfoSlice.name]: InstanceInfoState;
    [deviceStatusSlice.name]: DeviceStatusState;
    [masterServerStatusSlice.name]: MasterServerStatusState;
    [slaveConnectionStatusSlice.name]: SlaveConnectionStatusState;
    [systemParametersSlice.name]: SystemParametersState;
    [requestStatusSlice.name]: RequestStatusState;
    [terminalInfoSlice.name]: TerminalInfoState;
    [terminalConnectionStatusSlice.name]: TerminalConnectionStatusState;
}

/** 扩展 RootState 接口(供其他模块扩展) */
export interface RootState extends RootStateBase, UnitDataGroupStates,PersistPartial {
}

export type AppEpic = Epic<PayloadAction, PayloadAction, RootState>;
