import {Reducer} from "@reduxjs/toolkit";

export interface ModuleSliceConfig<State = any> {
    name: string
    reducer: Reducer<State>  // 只保留 Reducer 类型
    statePersistToStorage: boolean
    stateSyncToSlave: boolean
}