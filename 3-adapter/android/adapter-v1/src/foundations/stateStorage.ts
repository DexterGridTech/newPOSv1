import {MMKV} from 'react-native-mmkv'

const mmkv = new MMKV()

export const stateStorageAdapter = {
    getItem: async (key: string): Promise<any> => {
        const val = mmkv.getString(key)
        if (val === undefined) return null
        try { return JSON.parse(val) } catch { return val }
    },
    setItem: async (key: string, value: any): Promise<void> => {
        mmkv.set(key, JSON.stringify(value))
    },
    removeItem: async (key: string): Promise<void> => {
        mmkv.delete(key)
    },
}

export const mmkvInstance = mmkv
