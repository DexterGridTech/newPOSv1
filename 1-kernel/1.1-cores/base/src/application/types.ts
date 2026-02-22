import {Environment, ModuleSliceConfig, RootState, ServerSpace} from "../types";
import {Epic} from "redux-observable";
import {Actor, DefinedErrorMessage, DefinedSystemParameter, ScreenPartRegistration} from "../foundations";
import {Middleware, PayloadAction, StoreEnhancer} from "@reduxjs/toolkit";

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Array<infer U>
        ? Array<DeepPartial<U>>
        : T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ApplicationConfig {
    serverSpace: ServerSpace
    environment: Environment
    preInitiatedState: DeepPartial<RootState>
    module: AppModule
    reactotronEnhancer?: StoreEnhancer
}

export interface AppModule {
    name: string
    version: string
    slices: Record<string, ModuleSliceConfig>
    epics: Record<string, Epic<PayloadAction, PayloadAction, RootState>>
    middlewares: Record<string, {middleware:Middleware,priority:number}>
    actors: Record<string, Actor>
    commands: Record<string, any>
    errorMessages: Record<string, DefinedErrorMessage>
    parameters: Record<string, DefinedSystemParameter<any>>
    screenParts?: Record<string, ScreenPartRegistration>
    dependencies: AppModule[]
    modulePreSetup?: (config: ApplicationConfig, allModules: AppModule[]) => Promise<void>
    preSetupPriority?: number
}