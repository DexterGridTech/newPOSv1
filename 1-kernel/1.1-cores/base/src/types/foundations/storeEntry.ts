/**
 * StoreEntry 提供对 Redux Store 的访问入口
 * 支持在其他 package 中扩展功能
 */
import {EnhancedStore, PayloadAction} from "@reduxjs/toolkit";
import {RootState} from "../moduleState";
import {Environment} from "../shared/environment";
import {ServerSpace} from "./serverSpace";
import {stateStorage} from "../../foundations/adapters/stateStorage";

export interface StoreEntry {
    setStore: (store: EnhancedStore) => void
    getStore: () => EnhancedStore | null

    getStateByKey<K extends keyof RootState>(stateKey: K): RootState[K]
    getState(): RootState

    dispatchAction:(action: PayloadAction) => void

    setEnvironment: (env: Environment) => void
    getEnvironment: () => Environment

    setServerSpace: (serverSpace: ServerSpace) => void
    getServerSpace: () => ServerSpace
}

class StoreEntryImpl implements StoreEntry {
    private store: EnhancedStore | null = null;
    private environment: Environment | null = null;
    private serverSpace: ServerSpace | null = null;

    setStore(store: EnhancedStore) {
        this.store = store
    }

    getStore(): EnhancedStore | null {
        return this.store
    }

    getStateByKey<K extends keyof RootState>(stateKey: K): RootState[K] {
        if (!this.store) {
            throw new Error('Store is not initialized yet')
        }
        const state = this.store.getState() as RootState
        if (!state[stateKey]) {
            throw new Error(`State key '${stateKey}' does not exist`)
        }
        return state[stateKey]
    }
    getState(): RootState {
        if (!this.store) {
            throw new Error('Store is not initialized yet')
        }
        return this.store.getState() as RootState
    }
    dispatchAction(action: PayloadAction<any>)  {
        if (!this.store) {
            throw new Error('Store is not initialized yet')
        }
        this.store.dispatch(action)
    }

    setEnvironment(env: Environment) {
        this.environment = env
    }

    getEnvironment(): Environment {
        if (!this.environment) throw new Error('Environment not initialized')
        return this.environment
    }

    setServerSpace(serverSpace: ServerSpace) {
        this.serverSpace = serverSpace
    }

    getServerSpace(): ServerSpace {
        if (!this.serverSpace) throw new Error('ServerSpace not initialized')
        return this.serverSpace
    }

    async getDataVersion(): Promise<number> {
        return (await stateStorage.getItem(`DataVersion-${this.getServerSpace().selectedSpace}`) as number)??0
    }
    async setDataVersion(version: number) {
        await stateStorage.setItem(`DataVersion-${this.getServerSpace().selectedSpace}`, version)
    }
    async setSelectServerSpace(selectedSpace: string) {
        await stateStorage.setItem('SelectedServerSpace', selectedSpace)
    }
    async getSelectServerSpace() {
        return stateStorage.getItem('SelectedServerSpace')
    }
}

// 导出单例实例，供其他 package 扩展和使用
export const storeEntry = new StoreEntryImpl()

