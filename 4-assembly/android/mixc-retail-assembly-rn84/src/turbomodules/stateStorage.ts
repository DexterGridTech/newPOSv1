import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import NativeStateStorageTurboModule from './specs/NativeStateStorageTurboModule'

export const createNativeStateStorage = (
    namespace: string,
): StateStoragePort => {
    const prefix = `${namespace}:`
    const keyOf = (key: string) => `${prefix}${key}`

    return {
        async getItem(key) {
            return await NativeStateStorageTurboModule.getString(keyOf(key))
        },
        async setItem(key, value) {
            await NativeStateStorageTurboModule.setString(keyOf(key), value)
        },
        async removeItem(key) {
            await NativeStateStorageTurboModule.remove(keyOf(key))
        },
        async multiGet(keys) {
            const entries = await Promise.all(keys.map(async key => [key, await this.getItem(key)] as const))
            return Object.fromEntries(entries)
        },
        async multiSet(entries) {
            await Promise.all(Object.entries(entries).map(([key, value]) => this.setItem(key, value)))
        },
        async multiRemove(keys) {
            await Promise.all(keys.map(key => this.removeItem(key)))
        },
        async getAllKeys() {
            const keys = await NativeStateStorageTurboModule.getAllKeys()
            return keys
                .filter(key => key.startsWith(prefix))
                .map(key => key.slice(prefix.length))
        },
        async clear() {
            const keys = await this.getAllKeys?.() ?? []
            await this.multiRemove?.(keys)
        },
    }
}
