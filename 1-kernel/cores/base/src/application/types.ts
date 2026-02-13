import {Environment, ModuleSliceConfig, RootState} from "../types";
import {Epic} from "redux-observable";
import {Api, DefinedErrorMessage, DefinedSystemParameter, Actor, Command} from "../foundations";
import {Middleware, PayloadAction, StoreEnhancer} from "@reduxjs/toolkit";

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
    epics: Record<string, Epic<PayloadAction, PayloadAction, RootState>>
    middlewares: Record<string, Middleware>
    actors: Record<string, Actor>
    commands: Record<string, any>
    apis: Record<string, Api<any, any>>
    errorMessages: Record<string, DefinedErrorMessage>
    parameters: Record<string, DefinedSystemParameter<any>>
    dependencies: AppModule[]
    modulePreInitiate?: (config: ApplicationConfig,allModules:AppModule[]) => Promise<void>
    loadingPriority?: number
}