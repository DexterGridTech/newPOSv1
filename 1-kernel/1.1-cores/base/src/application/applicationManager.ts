import {configureStore, EnhancedStore, Middleware, PayloadAction, Reducer} from "@reduxjs/toolkit";
import {Persistor, persistReducer, persistStore} from "redux-persist";
import {RootState, ServerSpace, storeEntry} from "../types";
import {ModuleDependencyResolver} from "./moduleDependencyResolver";
import {ApplicationConfig} from "./types";
import {setEnvironment} from "../foundations/environment";
import {
    ActorSystem, ApiManager,
    registerModuleCommands,
    registerModuleErrorMessages,
    registerModuleSystemParameter,
    screenPartRegisters, setStateStoragePrefix, stateStorage
} from "../foundations";
import {getStateStoragePrefix} from "../foundations/adapters/stateStorage";
import {combineEpics, createEpicMiddleware} from "redux-observable";
import {InitLogger} from "./initLogger";


export class ApplicationManager {
    private static instance: ApplicationManager | null = null;
    private store: EnhancedStore<RootState> | null = null;
    private persistor: Persistor | null = null;
    private moduleDependencyResolver = new ModuleDependencyResolver()

    static getInstance(): ApplicationManager {
        if (!ApplicationManager.instance) {
            ApplicationManager.instance = new ApplicationManager();
        }
        return ApplicationManager.instance;
    }

    getStore(): EnhancedStore<RootState> | null {
        return this.store;
    }

    getPersistor(): Persistor | null {
        return this.persistor;
    }

    async generateStore(config: ApplicationConfig) {
        storeEntry.setEnvironment(config.environment);

        const initLogger = InitLogger.getInstance();

        // 打印横幅
        initLogger.logBanner();

        // 步骤 1: 设置环境
        initLogger.logStep(1, 'Setting Environment');
        setEnvironment(config.environment);
        initLogger.logDetail('Device ID', config.environment.deviceId);
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
        initLogger.logStep(3, 'Pre-Setup Modules');
        for (const module of allModules) {
            await module.modulePreSetup?.(config, allModules);
            initLogger.logSuccess(`${module.name} finished pre-setup`);
        }
        initLogger.logStepEnd();

        // 步骤 4: 初始化 API Server
        initLogger.logStep(4, 'Initializing API Server');
        let selectedServerSpace= await stateStorage.getItem("SelectedServerSpace") as string;
        selectedServerSpace= this.initApiServerAddress(config.serverSpace, selectedServerSpace);
        config.serverSpace.selectedSpace = selectedServerSpace;
        storeEntry.setServerSpace(config.serverSpace);
        await stateStorage.setItem("SelectedServerSpace", selectedServerSpace);
        const selectedSpaceConfig = config.serverSpace.spaces.find(s => s.name === selectedServerSpace)!;
        initLogger.logDetail('Selected Space', selectedServerSpace);
        selectedSpaceConfig.serverAddresses.forEach(addr => {
            addr.addresses.forEach(a => {
                initLogger.logDetail(`  ${addr.serverName}`, a.baseURL);
            });
        });

        let dataVersion= (await stateStorage.getItem(`DataVersion-${selectedServerSpace}`) as number)??0;
        await stateStorage.setItem("DataVersion-${selectedServerSpace}", dataVersion);
        const storagePrefix = `${selectedServerSpace}-${dataVersion}`;
        setStateStoragePrefix(storagePrefix);
        initLogger.logDetail('Storage Prefix', storagePrefix);
        initLogger.logSuccess(`API Server initialized`);
        initLogger.logStepEnd();

        // 步骤 5: 注册 Actors
        initLogger.logStep(5, 'Registering Actors');
        let totalActors = 0;
        allModules.forEach(module => {
            const actorCount = Object.keys(module.actors).length;
            if (actorCount > 0) {
                initLogger.logDetail(`${module.name}`, actorCount);
                initLogger.logNames(Object.values(module.actors).map(a => a.actorName));
                totalActors += actorCount;
                Object.values(module.actors).forEach(actor => {
                    ActorSystem.getInstance().registerActor(actor);
                });
            }
        });
        initLogger.logSuccess(`Registered ${totalActors} actors`);
        initLogger.logStepEnd();

        // 步骤 6: 注册 Commands
        initLogger.logStep(6, 'Registering Commands');
        let totalCommands = 0;
        allModules.forEach(module => {
            const commandCount = Object.keys(module.commands).length;
            if (commandCount > 0) {
                initLogger.logDetail(`${module.name}`, commandCount);
                initLogger.logNames(Object.keys(module.commands));
                totalCommands += commandCount;
                registerModuleCommands(module.name, module.commands);
            }
        });
        initLogger.logSuccess(`Registered ${totalCommands} commands`);
        initLogger.logStepEnd();


        // 步骤 7: 注册 Screen Parts
        initLogger.logStep(7, 'Registering Screen Parts');
        let totalScreenParts = 0;
        allModules.forEach(module => {
            const screenPartCount = Object.keys(module.screenParts || {}).length;
            if (screenPartCount > 0) {
                initLogger.logDetail(`${module.name}`, screenPartCount);
                initLogger.logNames(Object.values(module.screenParts!).map(sp => `${sp.partKey} (${sp.name})`));
                totalScreenParts += screenPartCount;
                Object.values(module.screenParts!).forEach(screenPart => {
                    screenPartRegisters.forEach(register => register.registerScreenPart(screenPart));
                });
            }
        });
        initLogger.logSuccess(`Registered ${totalScreenParts} screen parts`);
        initLogger.logStepEnd();

        // 步骤 8: 注册 Error Messages
        initLogger.logStep(8, 'Registering Error Messages');
        let totalErrors = 0;
        allModules.forEach(module => {
            const errorCount = Object.keys(module.errorMessages).length;
            if (errorCount > 0) {
                initLogger.logDetail(`${module.name}`, errorCount);
                initLogger.logNames(Object.values(module.errorMessages).map(e => e.key));
                totalErrors += errorCount;
                registerModuleErrorMessages(module.name, Object.values(module.errorMessages));
            }
        });
        initLogger.logSuccess(`Registered ${totalErrors} error messages`);
        initLogger.logStepEnd();

        // 步骤 9: 注册 System Parameters
        initLogger.logStep(9, 'Registering System Parameters');
        let totalParams = 0;
        allModules.forEach(module => {
            const paramCount = Object.keys(module.parameters).length;
            if (paramCount > 0) {
                initLogger.logDetail(`${module.name}`, paramCount);
                initLogger.logNames(Object.values(module.parameters).map(p => p.key));
                totalParams += paramCount;
                registerModuleSystemParameter(module.name, Object.values(module.parameters));
            }
        });
        initLogger.logSuccess(`Registered ${totalParams} system parameters`);
        initLogger.logStepEnd();

        // 步骤 9: 构建 Reducers
        initLogger.logStep(9, 'Building Reducers');
        const rootReducer: Record<string, Reducer> = {};
        let persistedCount = 0;
        allModules.forEach(module => {
            const sliceCount = Object.keys(module.slices).length;
            if (sliceCount > 0) {
                let modulePersisted = 0;
                const sliceNames: string[] = [];
                Object.values(module.slices).forEach(sliceConfig => {
                    const persisted = sliceConfig.persistToStorage && (config.environment.displayIndex === 0);
                    sliceNames.push(persisted ? `${sliceConfig.name} [persisted]` : sliceConfig.name);
                    if (persisted) {
                        persistedCount++;
                        modulePersisted++;
                        const persistConfig = {
                            keyPrefix: getStateStoragePrefix(),
                            key: sliceConfig.name,
                            storage: stateStorage,
                            blacklist: sliceConfig.persistBlacklist || [],
                        };
                        rootReducer[sliceConfig.name] = persistReducer(persistConfig, sliceConfig.reducer);
                    } else {
                        rootReducer[sliceConfig.name] = sliceConfig.reducer;
                    }
                });
                const persistInfo = modulePersisted > 0 ? ` (${modulePersisted} persisted)` : '';
                initLogger.logDetail(`${module.name}`, `${sliceCount}${persistInfo}`);
                initLogger.logNames(sliceNames);
            }
        });
        const reducerCount = Object.keys(rootReducer).length;
        initLogger.logSuccess(`Built ${reducerCount} reducers (${persistedCount} persisted)`);
        initLogger.logStepEnd();

        // 步骤 10: 配置 Middleware
        initLogger.logStep(10, 'Configuring Middleware');
        const epicMiddleware = createEpicMiddleware<PayloadAction, PayloadAction, RootState>();
        const moduleMiddlewares: { middleware: Middleware, priority: number, name: string }[] = [];
        allModules.forEach(module => {
            Object.entries(module.middlewares).forEach(([middlewareName, config]) => {
                moduleMiddlewares.push({
                    middleware: config.middleware,
                    priority: config.priority,
                    name: `${module.name}.${middlewareName}`
                });
            });
        });
        // 按 priority 升序排序（数值越小优先级越高）
        moduleMiddlewares.sort((a, b) => a.priority - b.priority);
        const middlewares: Middleware[] = [epicMiddleware, ...moduleMiddlewares.map(m => m.middleware)];
        const middlewareNames: string[] = ['epicMiddleware', ...moduleMiddlewares.map(m => `${m.name}(p:${m.priority})`)];
        initLogger.logDetail('Middleware Count', middlewares.length);
        initLogger.logNames(middlewareNames);
        initLogger.logSuccess('Middleware configured');
        initLogger.logStepEnd();

        // 步骤 11: 创建 Redux Store
        initLogger.logStep(11, 'Creating Redux Store');
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

        // 步骤 12: 注册 Epics
        initLogger.logStep(12, 'Registering Epics');
        let totalEpics = 0;
        allModules.forEach(module => {
            const epicCount = Object.keys(module.epics).length;
            if (epicCount > 0) {
                initLogger.logDetail(`${module.name}`, epicCount);
                totalEpics += epicCount;
            }
        });
        const epics = allModules.flatMap(module => Object.values(module.epics));
        if (epics.length > 0) {
            epicMiddleware.run(combineEpics(...epics));
        }
        initLogger.logSuccess(`Registered ${totalEpics} epics and running`);
        initLogger.logStepEnd();

        // 步骤 13: 创建 Persistor
        initLogger.logStep(13, 'Creating Persistor');
        const persistor = persistStore(store);
        initLogger.logSuccess('Persistor created');
        initLogger.logStepEnd();

        // 打印总结
        initLogger.logSummary(allModules);

        this.store = store;
        this.persistor = persistor;
        return {store, persistor};
    }

     initApiServerAddress(serverSpace: ServerSpace, selectedSpace?: string): string {
        let selectedServerSpace = selectedSpace ? serverSpace.spaces.find(s => s.name === selectedSpace) : null;
        if (!selectedServerSpace) {
            selectedServerSpace = serverSpace.spaces.find(s => s.name === serverSpace.selectedSpace)
        }
        if (!selectedServerSpace) {
            selectedServerSpace = serverSpace.spaces[0]
        }
        if (!selectedServerSpace) {
            throw new Error('No server space found')
        }
        selectedServerSpace.serverAddresses.forEach(serverAddress => {
            ApiManager.getInstance().initApiServerAddress(serverAddress);
        })
        return selectedServerSpace.name
    }
}
