import { Store } from '@tauri-apps/plugin-store'

// 单例 store，懒初始化
let _store: Store | null = null

async function getStore(): Promise<Store> {
    if (!_store) {
        _store = await Store.load('pos-state.json', { autoSave: 300 })
    }
    return _store
}

export const stateStorageAdapter = {
    getItem: async (key: string): Promise<any> => {
        const store = await getStore()
        const val = await store.get<string>(key)
        if (val === null || val === undefined) return null
        try {
            return JSON.parse(val)
        } catch {
            return val
        }
    },

    setItem: async (key: string, value: any): Promise<void> => {
        const store = await getStore()
        await store.set(key, JSON.stringify(value))
    },

    removeItem: async (key: string): Promise<void> => {
        const store = await getStore()
        await store.delete(key)
    },
}
