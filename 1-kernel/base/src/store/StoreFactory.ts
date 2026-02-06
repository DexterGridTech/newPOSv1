import {configureStore, EnhancedStore, PayloadAction} from "@reduxjs/toolkit";
import {createEpicMiddleware} from "redux-observable";
import {RootState} from "../features";
import {setStoreAccessor} from "../core";
import {
    IMiddlewareConfigurator,
    IModuleDependencyResolver,
    IModuleRegistrar,
    IReducerBuilder,
    IStoreInitializer,
    KernelModule,
    StoreConfig
} from "./types";
import {ActorSystemConfigurator} from "./initializers/ActorSystemConfigurator";
import {ModuleRegistrar} from "./initializers/ModuleRegistrar";
import {StoreInitLogger} from "./logger/StoreInitLogger";
import {persistStore,} from 'redux-persist';

/**
 * Store 工厂类
 * 职责: 负责协调各个组件创建 Store
 * 使用依赖注入,遵循开闭原则和依赖倒置原则
 */
export class StoreFactory {
    private reducerBuilder: IReducerBuilder;
    private middlewareConfigurator: IMiddlewareConfigurator;
    private nativeAdapterInitializer: IStoreInitializer;
    private actorSystemConfigurator: ActorSystemConfigurator;
    private moduleRegistrar: IModuleRegistrar;
    private moduleDependencyResolver: IModuleDependencyResolver;
    private logger: StoreInitLogger;

    constructor(
        reducerBuilder: IReducerBuilder,
        middlewareConfigurator: IMiddlewareConfigurator,
        nativeAdapterInitializer: IStoreInitializer,
        actorSystemConfigurator: ActorSystemConfigurator,
        moduleRegistrar: IModuleRegistrar,
        moduleDependencyResolver: IModuleDependencyResolver
    ) {
        this.reducerBuilder = reducerBuilder;
        this.middlewareConfigurator = middlewareConfigurator;
        this.nativeAdapterInitializer = nativeAdapterInitializer;
        this.actorSystemConfigurator = actorSystemConfigurator;
        this.moduleRegistrar = moduleRegistrar;
        this.moduleDependencyResolver = moduleDependencyResolver;
        this.logger = new StoreInitLogger();
    }

    async createStore(config: StoreConfig) {
        // 打印横幅
        this.logger.logBanner();

        // 步骤 1: 解析模块依赖
        this.logger.logStep(1, 'Resolving Module Dependencies');
        this.logger.logDetail('Input Modules', config.kernelModules.length);
        const resolvedModules = this.moduleDependencyResolver.resolveModules(config.kernelModules);
        this.logger.logDetail('Resolved Modules', resolvedModules.length);
        resolvedModules.forEach((module: KernelModule, index: number) => {
            this.logger.logModule(module, index, resolvedModules.length);
        });
        this.logger.logStepEnd();

        // 步骤 2: 初始化 Native Adapter 和 API Server
        this.logger.logStep(2, 'Initializing Native Adapter & API Server');
        this.logger.logDetail('Native Adapter', config.nativeAdapter ? 'Provided' : 'Not Provided');
        this.logger.logDetail('Workspace', config.workspace.selectedWorkspace);
        await this.nativeAdapterInitializer.initialize(config);
        this.logger.logSuccess('Native Adapter initialized');
        this.logger.logStepEnd();


        // 步骤 3: 构建 Reducers
        this.logger.logStep(3, 'Building Reducers');

        const rootReducer = await this.reducerBuilder.buildReducers(config.standAlone, resolvedModules, config.workspace.selectedWorkspace)
        const reducerCount = Object.keys(rootReducer).length;
        this.logger.logDetail('Total Reducers', reducerCount);
        this.logger.logSuccess('Reducers built successfully');
        this.logger.logStepEnd();

        // 步骤 4: 创建 Epic Middleware
        this.logger.logStep(4, 'Creating Epic Middleware');
        const epicMiddleware = createEpicMiddleware<PayloadAction, PayloadAction, RootState>();
        this.logger.logSuccess('Epic Middleware created');
        this.logger.logStepEnd();

        // 步骤 5: 配置 Middleware
        this.logger.logStep(5, 'Configuring Middleware');
        const middlewares = this.middlewareConfigurator.configureMiddleware(epicMiddleware);
        this.logger.logDetail('Middleware Count', middlewares.length);
        this.logger.logSuccess('Middleware configured');
        this.logger.logStepEnd();

        // 步骤 6: 创建 Store
        this.logger.logStep(6, 'Creating Redux Store');
        this.logger.logDetail('Reactotron', config.reactotronEnhancer ? 'Enabled' : 'Disabled');

        const storeOptions: any = {
            reducer: rootReducer,
            preloadedState: config.preInitiatedState as RootState,
            middleware: (getDefaultMiddleware: any) =>
                getDefaultMiddleware({
                    serializableCheck: false
                }).concat(middlewares)
        };

        // 如果提供了 Reactotron enhancer，添加到 store 配置中
        if (config.reactotronEnhancer) {
            storeOptions.enhancers = (getDefaultEnhancers: any) =>
                getDefaultEnhancers().concat(config.reactotronEnhancer);
        }

        const store = configureStore(storeOptions) as EnhancedStore<RootState>;
        this.logger.logSuccess('Redux Store created');
        this.logger.logStepEnd();

        // 步骤 7: 设置 Store 访问器
        this.logger.logStep(7, 'Setting Store Accessor');
        setStoreAccessor({
            getState: () => store.getState(),
            dispatch: (action: any) => store.dispatch(action as PayloadAction)
        });
        this.logger.logSuccess('Store Accessor set');
        this.logger.logStepEnd();

        // 步骤 8: 配置 ActorSystem
        this.logger.logStep(8, 'Configuring ActorSystem');
        this.actorSystemConfigurator.configureStateSelectors(store);
        this.logger.logSuccess('State Selectors configured');
        this.actorSystemConfigurator.configureLifecycleListeners();
        this.logger.logSuccess('Lifecycle Listeners configured');
        this.logger.logStepEnd();

        // 步骤 9: 注册模块
        this.logger.logStep(9, 'Registering Modules');
        const totalActors = resolvedModules.reduce((sum: number, m: KernelModule) => sum + (m.actors?.length || 0), 0);
        const totalEpics = resolvedModules.reduce((sum: number, m: KernelModule) => sum + (m.epics?.length || 0), 0);
        const totalScreenParts = resolvedModules.reduce((sum: number, m: KernelModule) => sum + (m.screenParts?.length || 0), 0);

        this.moduleRegistrar.registerModules(resolvedModules);
        this.logger.logSuccess(`Registered ${totalActors} Actors`);

        (this.moduleRegistrar as ModuleRegistrar).registerEpics(resolvedModules, epicMiddleware);
        this.logger.logSuccess(`Registered ${totalEpics} Epics`);

        (this.moduleRegistrar as ModuleRegistrar).registerScreenParts(resolvedModules);
        this.logger.logSuccess(`Registered ${totalScreenParts} ScreenParts`);
        this.logger.logStepEnd();

        // 打印总结
        this.logger.logSummary(resolvedModules);
        const persistor = persistStore(store);
        return {store, persistor};
    }
}
