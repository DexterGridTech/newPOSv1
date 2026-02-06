import {AppEpic, RootState} from "../features";
import {IPosAdapter, IStorageAdapter, Workspace} from "../types";
import {IActor} from "../core";
import {ScreenPartRegistration} from "@impos2/kernel-module-ui-navigation";
import {Reducer, StoreEnhancer} from "@reduxjs/toolkit";

/**
 * Kernel 模块接口
 */
export interface KernelModule {
    name: string; // 模块名称(必选)
    reducers: Partial<Record<keyof Omit<RootState, keyof RootState>, any>>;
    epics: AppEpic[];
    actors: IActor[];
    screenParts?: ScreenPartRegistration[];
    dependencies?: KernelModule[];
}

/**
 * Store 配置接口
 */
export interface StoreConfig {
    standAlone: boolean
    preInitiatedState: Partial<RootState>
    workspace: Workspace
    kernelModules: KernelModule[]
    nativeAdapter?: IPosAdapter
    /**
     * Reactotron enhancer (可选)
     * 用于在开发环境下集成 Reactotron 调试工具
     */
    reactotronEnhancer?: StoreEnhancer
}

/**
 * Store 初始化器接口 - 单一职责原则 (SRP)
 */
export interface IStoreInitializer {
    initialize(config: StoreConfig): Promise<void>;
}

/**
 * Reducer 构建器接口 - 单一职责原则 (SRP)
 */
export interface IReducerBuilder {
    buildReducers(standAlone:boolean,modules: KernelModule[], currentWorkspace: string): Promise<Record<string, Reducer>>;
}

/**
 * Middleware 配置器接口 - 单一职责原则 (SRP)
 */
export interface IMiddlewareConfigurator {
    configureMiddleware(epicMiddleware: any): any[];
}

/**
 * 模块注册器接口 - 单一职责原则 (SRP)
 */
export interface IModuleRegistrar {
    registerModules(modules: KernelModule[]): void;
}

/**
 * 模块依赖解析器接口 - 单一职责原则 (SRP)
 */
export interface IModuleDependencyResolver {
    resolveModules(modules: KernelModule[]): KernelModule[];
}

/**
 * ScreenPart 注册函数类型
 */
export type ScreenPartRegisterFunction = (screenPart: ScreenPartRegistration) => void;

