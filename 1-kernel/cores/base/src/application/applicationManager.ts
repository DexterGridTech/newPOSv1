import {configureStore, EnhancedStore, Middleware, PayloadAction, Reducer} from "@reduxjs/toolkit";
import {Persistor, persistReducer, persistStore} from "redux-persist";
import {RootState, storeEntry} from "../types";
import {ModuleDependencyResolver} from "./moduleDependencyResolver";
import {ApplicationConfig} from "./types";
import {setEnvironment} from "../foundations/environment";
import {
    ActorSystem,
    registerModuleCommands,
    registerModuleErrorMessages,
    registerModuleSystemParameter
} from "../foundations";
import {getStateStorage, getStateStoragePrefix} from "../foundations/stateStorage";
import {combineEpics, createEpicMiddleware} from "redux-observable";
import {InitLogger} from "./initLogger";


export class ApplicationManager {
    private static instance: ApplicationManager | null = null;
    private store: EnhancedStore<RootState> | null = null;
    private persistor: Persistor | null = null;
    private moduleDependencyResolver = new ModuleDependencyResolver()
    private storeGenerationPromise: Promise<{ store: EnhancedStore<RootState>, persistor: Persistor }> | null = null;

    static getInstance(): ApplicationManager {
        if (!ApplicationManager.instance) {
            ApplicationManager.instance = new ApplicationManager();
        }
        return ApplicationManager.instance;
    }

    async generateStore(config: ApplicationConfig) {
        // 双重检查锁定：如果已经有 store，直接返回
        if (this.store && this.persistor) {
            return {store: this.store, persistor: this.persistor};
        }

        // 如果正在创建中，等待创建完成
        if (this.storeGenerationPromise) {
            return this.storeGenerationPromise;
        }
        // 创建 store
        this.storeGenerationPromise = this.createStore(config).then(({store, persistor}) => {
            this.store = store;
            this.persistor = persistor;
            return {store, persistor};
        }).catch((error) => {
            // 创建失败，清除 Promise 缓存，允许重试
            this.storeGenerationPromise = null;
            throw error;
        });

        return this.storeGenerationPromise;
    }

    getStore(): EnhancedStore<RootState> | null {
        return this.store;
    }

    getPersistor(): Persistor | null {
        return this.persistor;
    }

    private async createStore(config: ApplicationConfig) {
        const initLogger = new InitLogger();

        // 打印横幅
        initLogger.logBanner();

        // 步骤 1: 设置环境
        initLogger.logStep(1, 'Setting Environment');
        setEnvironment(config.environment);
        initLogger.logDetail('Production', config.environment.production);
        initLogger.logDetail('ScreenMode', config.environment.screenMode);
        initLogger.logDetail('Display Count', config.environment.displayCount);
        initLogger.logDetail('Display Index', config.environment.displayIndex);
        initLogger.logSuccess('Environment configured');
        initLogger.logStepEnd();

        // 步骤 2: 解析模块依赖
        initLogger.logStep(2, 'Resolving Module Dependencies');
        const allModules = this.moduleDependencyResolver.resolveModules([config.module]);
        initLogger.logDetail('Input Modules', 1);
        initLogger.logDetail('Resolved Modules', allModules.length);
        allModules.forEach((module, index) => {
            initLogger.logModule(module, index, allModules.length);
        });
        initLogger.logSuccess(`Resolved ${allModules.length} modules`);
        initLogger.logStepEnd();

        // 步骤 3: 模块预初始化
        initLogger.logStep(3, 'Pre-initializing Modules');
        for (const module of allModules) {
            await module.modulePreInitiate?.(config, allModules);
            initLogger.logSuccess(`${module.name} pre-initialized`);
        }
        initLogger.logStepEnd();

        // 步骤 4: 注册 Actors
        initLogger.logStep(4, 'Registering Actors');
        let totalActors = 0;
        allModules.forEach(module => {
            const actorCount = Object.keys(module.actors).length;
            if (actorCount > 0) {
                initLogger.logDetail(`${module.name}`, actorCount);
                totalActors += actorCount;
                Object.values(module.actors).forEach(actor => {
                    ActorSystem.getInstance().registerActor(actor);
                });
            }
        });
        initLogger.logSuccess(`Registered ${totalActors} actors`);
        initLogger.logStepEnd();

        // 步骤 5: 注册 Commands
        initLogger.logStep(5, 'Registering Commands');
        let totalCommands = 0;
        allModules.forEach(module => {
            const commandCount = Object.keys(module.commands).length;
            if (commandCount > 0) {
                initLogger.logDetail(`${module.name}`, commandCount);
                totalCommands += commandCount;
                registerModuleCommands(module.name, module.commands);
            }
        });
        initLogger.logSuccess(`Registered ${totalCommands} commands`);
        initLogger.logStepEnd();

        // 步骤 6: 注册 Error Messages
        initLogger.logStep(6, 'Registering Error Messages');
        let totalErrors = 0;
        allModules.forEach(module => {
            const errorCount = Object.keys(module.errorMessages).length;
            if (errorCount > 0) {
                initLogger.logDetail(`${module.name}`, errorCount);
                totalErrors += errorCount;
                registerModuleErrorMessages(module.name, Object.values(module.errorMessages));
            }
        });
        initLogger.logSuccess(`Registered ${totalErrors} error messages`);
        initLogger.logStepEnd();

        // 步骤 7: 注册 System Parameters
        initLogger.logStep(7, 'Registering System Parameters');
        let totalParams = 0;
        allModules.forEach(module => {
            const paramCount = Object.keys(module.parameters).length;
            if (paramCount > 0) {
                initLogger.logDetail(`${module.name}`, paramCount);
                totalParams += paramCount;
                registerModuleSystemParameter(module.name, Object.values(module.parameters));
            }
        });
        initLogger.logSuccess(`Registered ${totalParams} system parameters`);
        initLogger.logStepEnd();

        // 步骤 8: 构建 Reducers
        initLogger.logStep(8, 'Building Reducers');
        const rootReducer: Record<string, Reducer> = {};
        let persistedCount = 0;
        allModules.forEach(module => {
            const sliceCount = Object.keys(module.slices).length;
            if (sliceCount > 0) {
                let modulePersisted = 0;
                Object.values(module.slices).forEach(sliceConfig => {
                    if (sliceConfig.statePersistToStorage && (config.environment.displayIndex === 0)) {
                        persistedCount++;
                        modulePersisted++;
                        const stateStorage = getStateStorage();
                        const stateStoragePrefix = getStateStoragePrefix();
                        const storageKey = `${stateStoragePrefix}-${sliceConfig.name}`;
                        const persistConfig = {
                            key: storageKey,
                            storage: stateStorage,
                        };
                        rootReducer[sliceConfig.name] = persistReducer(persistConfig, sliceConfig.reducer);
                    } else {
                        rootReducer[sliceConfig.name] = sliceConfig.reducer;
                    }
                });
                const persistInfo = modulePersisted > 0 ? ` (${modulePersisted} persisted)` : '';
                initLogger.logDetail(`${module.name}`, `${sliceCount}${persistInfo}`);
            }
        });
        const reducerCount = Object.keys(rootReducer).length;
        initLogger.logSuccess(`Built ${reducerCount} reducers (${persistedCount} persisted)`);
        initLogger.logStepEnd();

        // 步骤 9: 配置 Middleware
        initLogger.logStep(9, 'Configuring Middleware');
        const epicMiddleware = createEpicMiddleware<PayloadAction, PayloadAction, RootState>();
        const middlewares: Middleware[] = [epicMiddleware];
        allModules.forEach(module => {
            middlewares.push(...Object.values(module.middlewares));
        });
        initLogger.logDetail('Middleware Count', middlewares.length);
        initLogger.logSuccess('Middleware configured');
        initLogger.logStepEnd();

        // 步骤 10: 创建 Redux Store
        initLogger.logStep(10, 'Creating Redux Store');
        initLogger.logDetail('Reactotron', config.reactotronEnhancer ? 'Enabled' : 'Disabled');
        const storeOptions: any = {
            reducer: rootReducer,
            preloadedState: config.preInitiatedState,
            middleware: (getDefaultMiddleware: any) =>
                getDefaultMiddleware({
                    serializableCheck: false
                }).concat(middlewares)
        };

        if (config.reactotronEnhancer) {
            storeOptions.enhancers = (getDefaultEnhancers: any) =>
                getDefaultEnhancers().concat(config.reactotronEnhancer);
        }

        const store = configureStore(storeOptions) as EnhancedStore<RootState>;
        storeEntry.setStore(store);
        initLogger.logSuccess('Redux Store created');
        initLogger.logStepEnd();

        // 步骤 11: 注册 Epics
        initLogger.logStep(11, 'Registering Epics');
        let totalEpics = 0;
        allModules.forEach(module => {
            const epicCount = Object.keys(module.epics).length;
            if (epicCount > 0) {
                initLogger.logDetail(`${module.name}`, epicCount);
                totalEpics += epicCount;
            }
        });
        const epics = allModules.flatMap(module => Object.values(module.epics));
        epicMiddleware.run(combineEpics(...epics));
        initLogger.logSuccess(`Registered ${totalEpics} epics and running`);
        initLogger.logStepEnd();

        // 步骤 12: 创建 Persistor
        initLogger.logStep(12, 'Creating Persistor');
        const persistor = persistStore(store);
        initLogger.logSuccess('Persistor created');
        initLogger.logStepEnd();

        // 打印总结
        initLogger.logSummary(allModules);

        return {store, persistor};
    }
}
