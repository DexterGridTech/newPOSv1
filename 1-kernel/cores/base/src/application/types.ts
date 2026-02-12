import {Environment, ModuleSliceConfig, RootState} from "../types";
import {Epic} from "redux-observable";
import {DefinedErrorMessage, DefinedSystemParameter, IActor} from "../foundations";
import {Middleware, StoreEnhancer} from "@reduxjs/toolkit";

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

export interface AppModule {
    name: string
    version: string
    slices: Record<string, ModuleSliceConfig>
    epics: Record<string, Epic>
    middlewares: Middleware[]
    actors: Record<string, IActor>
    commands: Record<string, any>
    apis: any
    errorMessages: Record<string, DefinedErrorMessage>
    parameters: Record<string, DefinedSystemParameter<any>>
    dependencies: AppModule[]
    modulePreInitiate?: (config: ApplicationConfig) => Promise<void>
    modulePreInitiatePriority?: number
}