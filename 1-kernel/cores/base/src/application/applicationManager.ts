import {EnhancedStore} from "@reduxjs/toolkit";
import {Persistor} from "redux-persist";
import {RootState} from "../types";
import {ApplicationConfig} from "./applicationConfig";
import {ModuleDependencyResolver} from "./moduleDependencyResolver";

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

    }

}
