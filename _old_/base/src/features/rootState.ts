import {UnitDataState} from "../types";
import {PayloadAction} from "@reduxjs/toolkit";
import {Epic} from "redux-observable";
import {PersistPartial} from 'redux-persist/es/persistReducer';
import {KernelBaseStateMap} from "../types/stateNames";

export const UDG_ErrorMessages = 'UDG_ErrorMessages' as const
export const UDG_SystemParameters = 'UDG_SystemParameters' as const

export interface UnitDataGroupStates {
    [UDG_ErrorMessages]: UnitDataState
    [UDG_SystemParameters]: UnitDataState
}

export const unitDataGroups = new Set<keyof UnitDataGroupStates>()
unitDataGroups.add(UDG_ErrorMessages)
unitDataGroups.add(UDG_SystemParameters)

export interface RootStateBase extends KernelBaseStateMap {
}

/** 扩展 RootState 接口(供其他模块扩展) */
export interface RootState extends RootStateBase, UnitDataGroupStates,PersistPartial {
}
export type AppEpic = Epic<PayloadAction, PayloadAction, RootState>;
