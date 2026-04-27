import type {StateStoragePort} from '@next/kernel-base-platform-ports'

export interface MemoryStorageHarness {
    saved: Map<string, string>
    storage: StateStoragePort
}

export interface WebStorageHarness {
    storage: StateStoragePort
    clearNamespace(): Promise<void>
}

export type TestStorageMode = 'memory' | 'localStorage' | 'sessionStorage'

export interface TestStoragePair {
    stateStorage: StateStoragePort
    secureStateStorage: StateStoragePort
    clear?(): Promise<void>
}

export const createMemoryStorage = (): MemoryStorageHarness => {
    const saved = new Map<string, string>()
    return {
        saved,
        storage: {
            async getItem(key: string) {
                return saved.get(key) ?? null
            },
            async setItem(key: string, value: string) {
                saved.set(key, value)
            },
            async removeItem(key: string) {
                saved.delete(key)
            },
            async multiGet(keys: readonly string[]) {
                return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
            async getAllKeys() {
                return [...saved.keys()]
            },
            async clear() {
                saved.clear()
            },
        },
    }
}

const createUnavailableStorage = (storageName: string): Storage => {
    throw new Error(`${storageName} is not available in this runtime`)
}

const resolveBrowserStorage = (mode: Exclude<TestStorageMode, 'memory'>): Storage => {
    const globalValue = globalThis as typeof globalThis & {
        localStorage?: Storage
        sessionStorage?: Storage
    }
    if (mode === 'localStorage') {
        return globalValue.localStorage ?? createUnavailableStorage('localStorage')
    }
    return globalValue.sessionStorage ?? createUnavailableStorage('sessionStorage')
}

const toNamespacedKey = (namespace: string, key: string): string => `${namespace}:${key}`

export const createWebStoragePort = (input: {
    storage: Storage
    namespace: string
}): WebStorageHarness => {
    const prefix = `${input.namespace}:`
    const toKey = (key: string) => toNamespacedKey(input.namespace, key)
    return {
        storage: {
            async getItem(key: string) {
                return input.storage.getItem(toKey(key))
            },
            async setItem(key: string, value: string) {
                input.storage.setItem(toKey(key), value)
            },
            async removeItem(key: string) {
                input.storage.removeItem(toKey(key))
            },
            async multiGet(keys: readonly string[]) {
                return Object.fromEntries(keys.map(key => [key, input.storage.getItem(toKey(key))]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => {
                    input.storage.setItem(toKey(key), value)
                })
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => input.storage.removeItem(toKey(key)))
            },
            async getAllKeys() {
                const keys: string[] = []
                for (let index = 0; index < input.storage.length; index += 1) {
                    const key = input.storage.key(index)
                    if (key?.startsWith(prefix)) {
                        keys.push(key.slice(prefix.length))
                    }
                }
                return keys
            },
            async clear() {
                const keys: string[] = []
                for (let index = 0; index < input.storage.length; index += 1) {
                    const key = input.storage.key(index)
                    if (key?.startsWith(prefix)) {
                        keys.push(key)
                    }
                }
                keys.forEach(key => input.storage.removeItem(key))
            },
        },
        async clearNamespace() {
            await this.storage.clear?.()
        },
    }
}

export const createTestStoragePair = (input: {
    mode?: TestStorageMode
    namespace: string
}): TestStoragePair => {
    const mode = input.mode ?? 'localStorage'
    if (mode === 'memory') {
        const state = createMemoryStorage()
        const secure = createMemoryStorage()
        return {
            stateStorage: state.storage,
            secureStateStorage: secure.storage,
            async clear() {
                await state.storage.clear?.()
                await secure.storage.clear?.()
            },
        }
    }

    const browserStorage = resolveBrowserStorage(mode)
    const state = createWebStoragePort({
        storage: browserStorage,
        namespace: `${input.namespace}:state`,
    })
    const secure = createWebStoragePort({
        storage: browserStorage,
        namespace: `${input.namespace}:secure`,
    })
    return {
        stateStorage: state.storage,
        secureStateStorage: secure.storage,
        async clear() {
            await state.clearNamespace()
            await secure.clearNamespace()
        },
    }
}
