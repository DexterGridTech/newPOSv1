import {Reducer} from "@reduxjs/toolkit";

export interface ModuleSliceConfig<State = any, Actions = any> {
    name: string
    reducer: Reducer<State>  // 只保留 Reducer 类型
    actions: Actions
    statePersistToStorage: boolean
    stateSyncToSlave: boolean
}