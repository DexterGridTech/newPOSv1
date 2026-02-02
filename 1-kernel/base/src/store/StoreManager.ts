import {EnhancedStore} from "@reduxjs/toolkit";
import {RootState} from "../features";
import {ScreenPartRegisterFunction, StoreConfig} from "./types";
import {StoreFactory} from "./StoreFactory";
import {ReducerBuilder} from "./initializers/ReducerBuilder";
import {MiddlewareConfigurator} from "./initializers/MiddlewareConfigurator";
import {NativeAdapterInitializer} from "./initializers/NativeAdapterInitializer";
import {ActorSystemConfigurator} from "./initializers/ActorSystemConfigurator";
import {ModuleRegistrar} from "./initializers/ModuleRegistrar";
import {ModuleDependencyResolver} from "./resolvers/ModuleDependencyResolver";
import {Persistor} from "redux-persist/es/types";

/**
 * Store 单例管理器
 * 职责: 负责管理 Store 的单例实例
 */
export class StoreManager {
    private static instance: StoreManager | null = null;
    private store: EnhancedStore<RootState> | null = null;
    private persistor: Persistor | null = null;
    private storeFactory: StoreFactory;
    private moduleRegistrar: ModuleRegistrar;

    private constructor() {
        this.moduleRegistrar = new ModuleRegistrar();

        // 使用依赖注入创建 StoreFactory
        this.storeFactory = new StoreFactory(
            new ReducerBuilder(),
            new MiddlewareConfigurator(),
            new NativeAdapterInitializer(),
            new ActorSystemConfigurator(),
            this.moduleRegistrar,
            new ModuleDependencyResolver()
        );
    }

    static getInstance(): StoreManager {
        if (!StoreManager.instance) {
            StoreManager.instance = new StoreManager();
        }
        return StoreManager.instance;
    }

    generateStore(config: StoreConfig) {
        if (this.store) {
            throw new Error('Store already exists');
        }
        const {store, persistor} = this.storeFactory.createStore(config);
        this.store = store;
        this.persistor = persistor;
        return {store, persistor};
    }

    getStore(): EnhancedStore<RootState> | null {
        return this.store;
    }

    getPersistor(): Persistor | null {
        return this.persistor;
    }

    /**
     * 设置 ScreenPart 注册函数
     * 此方法应在 Store 创建前调用,用于注入 registerScreenPart 函数
     */
    setScreenPartRegisterFunction(fn: ScreenPartRegisterFunction): void {
        this.moduleRegistrar.setScreenPartRegisterFunction(fn);
    }

}
