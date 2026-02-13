import {configureStore, EnhancedStore, Middleware, PayloadAction, Reducer} from "@reduxjs/toolkit";
import {Persistor, persistReducer, persistStore} from "redux-persist";
import {LOG_TAGS, RootState, storeEntry} from "../types";
import {ModuleDependencyResolver} from "./moduleDependencyResolver";
import {ApplicationConfig} from "./types";
import {setEnvironment} from "../foundations/environment";
import {
    ActorSystem,
    logger,
    registerModuleCommands,
    registerModuleErrorMessages,
    registerModuleSystemParameter
} from "../foundations";
import {moduleName} from "../moduleName";
import {getStateStorage, getStateStoragePrefix} from "../foundations/stateStorage";
import {combineEpics, createEpicMiddleware} from "redux-observable";


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

    async generateStore(config: ApplicationConfig) {
        if (this.store) {
            throw new Error('Store already exists');
        }
        const {store, persistor} = await this.createStore(config);
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

    private async createStore(config: ApplicationConfig) {
        setEnvironment(config.environment)

        const allModules = this.moduleDependencyResolver.resolveModules([config.module]);
        logger.log([moduleName, LOG_TAGS.System, "createStore"], `loading ${allModules.length} modules`)


        for (const module of allModules) {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `preInitiate: ${module.name}`)
            await module.modulePreInitiate?.(config, allModules)
        }

        allModules.forEach(module => {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `register actor: ${module.name}`)
            Object.values(module.actors).forEach(actor => {
                ActorSystem.getInstance().registerActor(actor)
            })
        })

        allModules.forEach(module => {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `register command: ${module.name}`)
            registerModuleCommands(module.name, module.commands)
        })

        allModules.forEach(module => {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `register error messages: ${module.name}`)
            registerModuleErrorMessages(module.name, Object.values(module.errorMessages))
        })

        allModules.forEach(module => {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `register system parameters: ${module.name}`)
            registerModuleSystemParameter(module.name, Object.values(module.parameters))
        })

        const rootReducer: Record<string, Reducer> = {}
        allModules.forEach(module => {
            logger.log([moduleName, LOG_TAGS.System, "createStore"], `register reducer: ${module.name}`)
            Object.values(module.slices).forEach(sliceConfig => {
                if (sliceConfig.statePersistToStorage) {
                    const stateStorage = getStateStorage()
                    const stateStoragePrefix = getStateStoragePrefix()
                    const storageKey = `${stateStoragePrefix}-${sliceConfig.name}`
                    const persistConfig = {
                        key: storageKey,
                        storage: stateStorage,
                    };
                    rootReducer[sliceConfig.name] = persistReducer(persistConfig, sliceConfig.reducer);
                } else {
                    rootReducer[sliceConfig.name] = sliceConfig.reducer
                }
            })
        })


        const epicMiddleware = createEpicMiddleware<PayloadAction, PayloadAction, RootState>();
        const middlewares: Middleware[] = [epicMiddleware];
        allModules.forEach(module => {
            middlewares.push(...Object.values(module.middlewares))
        })

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
        storeEntry.setStore(store)

        const epics = allModules.flatMap(module => Object.values(module.epics))
        epicMiddleware.run(combineEpics(...epics))

        const persistor = persistStore(store);
        return {store, persistor};
    }
}
