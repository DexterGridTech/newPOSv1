import {Reducer} from "@reduxjs/toolkit";

export interface ModuleSliceConfig<State = any> {
    name: string
    reducer: Reducer<State>  // 只保留 Reducer 类型
    statePersistToStorage: boolean
    //如果stateSyncToSlave=true,state的属性需继承{updateAt:number}才能被同步
    stateSyncToSlave: boolean
    persistBlacklist?: string[]
}