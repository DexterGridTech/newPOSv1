import {EnhancedStore} from "@reduxjs/toolkit";
import {Persistor} from "redux-persist";
import {LOG_TAGS, RootState} from "../types";
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

        //todo

        // const {store, persistor} = await this.createStore(config);
        // this.store = store;
        // this.persistor = persistor;
        // return {store, persistor};
    }

    getStore(): EnhancedStore<RootState> | null {
        return this.store;
    }

    getPersistor(): Persistor | null {
        return this.persistor;
    }


    //todo
    private async createStore(config: ApplicationConfig) {
        setEnvironment(config.environment)

        const allModules = this.moduleDependencyResolver.resolveModules([config.module]);
        logger.log([moduleName], LOG_TAGS.System, `loading ${allModules.length} modules`)


        allModules.forEach(module => {
            logger.log([moduleName], LOG_TAGS.System, `preInitiate: ${module.name}`)
            module.modulePreInitiate?.(config)
        })

        allModules.forEach(module => {
            logger.log([moduleName], LOG_TAGS.System, `register actor: ${module.name}`)
            Object.values(module.actors).forEach(actor => {
                ActorSystem.getInstance().registerActor(actor)
            })
        })

        allModules.forEach(module => {
            logger.log([moduleName], LOG_TAGS.System, `register command: ${module.name}`)
            registerModuleCommands(module.name,module.commands)
        })

        allModules.forEach(module => {
            logger.log([moduleName], LOG_TAGS.System, `register error messages: ${module.name}`)
            registerModuleErrorMessages(module.name,Object.values(module.errorMessages))
        })

        allModules.forEach(module => {
            logger.log([moduleName], LOG_TAGS.System, `register system parameters: ${module.name}`)
            registerModuleSystemParameter(module.name,Object.values(module.parameters))
        })


    }

}
