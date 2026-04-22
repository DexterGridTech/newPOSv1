import { EnhancedStore } from "@reduxjs/toolkit";
import { Persistor } from "redux-persist";
import { RootState, ServerSpace } from "../types";
import { ApplicationConfig } from "./types";
export declare class ApplicationManager {
    private static instance;
    private store;
    private persistor;
    private initialized;
    private moduleDependencyResolver;
    static getInstance(): ApplicationManager;
    init(): void;
    getStore(): EnhancedStore<RootState> | null;
    getPersistor(): Persistor | null;
    generateStore(config: ApplicationConfig): Promise<{
        store: import("redux").Store<RootState, import("redux").UnknownAction, unknown>;
        persistor: Persistor;
    }>;
    initApiServerAddress(serverSpace: ServerSpace, selectedSpace?: string): string;
}
//# sourceMappingURL=applicationManager.d.ts.map