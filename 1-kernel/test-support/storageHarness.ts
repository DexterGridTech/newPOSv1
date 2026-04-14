import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const createMemoryStorage = () => {
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
        },
    }
}

const readStorageFile = (filePath: string): Record<string, string> => {
    if (!fs.existsSync(filePath)) {
        return {}
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) {
        return {}
    }
    return JSON.parse(raw) as Record<string, string>
}

const writeStorageFile = (filePath: string, content: Record<string, string>) => {
    fs.mkdirSync(path.dirname(filePath), {recursive: true})
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8')
}

export const createFileStorage = (filePath: string) => {
    return {
        filePath,
        storage: {
            async getItem(key: string) {
                return readStorageFile(filePath)[key] ?? null
            },
            async setItem(key: string, value: string) {
                const content = readStorageFile(filePath)
                content[key] = value
                writeStorageFile(filePath, content)
            },
            async removeItem(key: string) {
                const content = readStorageFile(filePath)
                delete content[key]
                writeStorageFile(filePath, content)
            },
            async multiGet(keys: readonly string[]) {
                const content = readStorageFile(filePath)
                return Object.fromEntries(keys.map(key => [key, content[key] ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                const content = readStorageFile(filePath)
                Object.entries(entries).forEach(([key, value]) => {
                    content[key] = value
                })
                writeStorageFile(filePath, content)
            },
            async multiRemove(keys: readonly string[]) {
                const content = readStorageFile(filePath)
                keys.forEach(key => {
                    delete content[key]
                })
                writeStorageFile(filePath, content)
            },
            async getAllKeys() {
                return Object.keys(readStorageFile(filePath))
            },
            async clear() {
                writeStorageFile(filePath, {})
            },
        },
        readSnapshot() {
            return readStorageFile(filePath)
        },
        reset() {
            writeStorageFile(filePath, {})
        },
    }
}

export const createFileStoragePair = (prefix = 'kernel-base-live') => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`))
    const stateFilePath = path.join(dir, 'state-storage.json')
    const secureStateFilePath = path.join(dir, 'secure-state-storage.json')

    const stateStorage = createFileStorage(stateFilePath)
    const secureStateStorage = createFileStorage(secureStateFilePath)

    return {
        dir,
        stateStorage,
        secureStateStorage,
        reset() {
            stateStorage.reset()
            secureStateStorage.reset()
        },
        cleanup() {
            fs.rmSync(dir, {recursive: true, force: true})
        },
    }
}
