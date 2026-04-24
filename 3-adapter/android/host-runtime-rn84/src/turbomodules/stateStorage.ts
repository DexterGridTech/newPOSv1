import type {StateStoragePort} from '@impos2/kernel-base-platform-ports'
import NativeStateStorageTurboModule from './specs/NativeStateStorageTurboModule'

export const createNativeStateStorage = (
    namespace: string,
): StateStoragePort => {
    const normalizeKey = (key: string): string => {
        const normalizedKey = key.trim()
        if (!normalizedKey) {
            throw new Error('assembly stateStorage key must not be empty')
        }
        return normalizedKey
    }

    return {
        async getItem(key) {
            return await NativeStateStorageTurboModule.getString(namespace, normalizeKey(key))
        },
        async setItem(key, value) {
            await NativeStateStorageTurboModule.setString(
                namespace,
                normalizeKey(key),
                value,
            )
        },
        async removeItem(key) {
            await NativeStateStorageTurboModule.remove(namespace, normalizeKey(key))
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
            return [...await NativeStateStorageTurboModule.getAllKeys(namespace)]
        },
        async clear() {
            await NativeStateStorageTurboModule.clearAll(namespace)
        },
    }
}
