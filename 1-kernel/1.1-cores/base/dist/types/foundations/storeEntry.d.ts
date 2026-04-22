/**
 * StoreEntry 提供对 Redux Store 的访问入口
 * 支持在其他 package 中扩展功能
 */
import { EnhancedStore, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../moduleState";
import { Environment } from "../shared/environment";
import { ServerSpace } from "./serverSpace";
export interface StoreEntry {
    setStore: (store: EnhancedStore) => void;
    getStore: () => EnhancedStore | null;
    getStateByKey<K extends keyof RootState>(stateKey: K): RootState[K];
    getState(): RootState;
    dispatchAction: (action: PayloadAction) => void;
    setEnvironment: (env: Environment) => void;
    getEnvironment: () => Environment;
    setServerSpace: (serverSpace: ServerSpace) => void;
    getServerSpace: () => ServerSpace;
}
declare class StoreEntryImpl implements StoreEntry {
    private store;
    private environment;
    private serverSpace;
    setStore(store: EnhancedStore): void;
    getStore(): EnhancedStore | null;
    getStateByKey<K extends keyof RootState>(stateKey: K): RootState[K];
    getState(): RootState;
    dispatchAction(action: PayloadAction<any>): void;
    setEnvironment(env: Environment): void;
    getEnvironment(): Environment;
    setServerSpace(serverSpace: ServerSpace): void;
    getServerSpace(): ServerSpace;
    getDataVersion(): Promise<number>;
    setDataVersion(version: number): Promise<void>;
    setSelectServerSpace(selectedSpace: string): Promise<void>;
    getSelectServerSpace(): Promise<any>;
}
export declare const storeEntry: StoreEntryImpl;
export {};
//# sourceMappingURL=storeEntry.d.ts.map