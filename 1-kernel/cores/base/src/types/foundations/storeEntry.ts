/**
 * StoreEntry 提供对 Redux Store 的访问入口
 * 支持在其他 package 中扩展功能
 */
import {EnhancedStore, PayloadAction} from "@reduxjs/toolkit";
import {RootState} from "../moduleState";

export interface StoreEntry {
    setStore: (store: EnhancedStore) => void
    getStore: () => EnhancedStore | null

    state<K extends keyof RootState>(stateKey: K): RootState[K]
    dispatchAction:(action: PayloadAction) => void
}

class StoreEntryImpl implements StoreEntry {
    private store: EnhancedStore | null = null;

    setStore(store: EnhancedStore) {
        this.store = store
    }

    getStore(): EnhancedStore | null {
        return this.store
    }

    state<K extends keyof RootState>(stateKey: K): RootState[K] {
        if (!this.store) {
            throw new Error('Store is not initialized yet')
        }
        const state = this.store.getState() as RootState
        if (!state[stateKey]) {
            throw new Error(`State key '${stateKey}' does not exist`)
        }
        return state[stateKey]
    }
    dispatchAction(action: PayloadAction<any>)  {
        if (!this.store) {
            throw new Error('Store is not initialized yet')
        }
        this.store.dispatch(action)
    }
}

// 导出单例实例，供其他 package 扩展和使用
export const storeEntry = new StoreEntryImpl()

