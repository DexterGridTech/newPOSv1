import {StoreEnhancer} from "@reduxjs/toolkit";
import {Environment, RootState} from "../types";
import {AppModule} from "./moduleType";

/**
 * 深度 Partial 类型，支持嵌套对象的部分属性
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ApplicationConfig {
    environment: Environment
    preInitiatedState: DeepPartial<RootState>
    // workspace: Workspace
    module: AppModule
    // nativeAdapter?: IPosAdapter
    reactotronEnhancer?: StoreEnhancer
}
