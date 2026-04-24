import {beforeEach, describe, expect, it, vi} from 'vitest'

const {createNativeStateStorageMock} = vi.hoisted(() => ({
    createNativeStateStorageMock: vi.fn((namespace: string) => {
        const values = new Map<string, string>()
        return {
            namespace,
            getItem: vi.fn(async (key: string) => values.get(key) ?? null),
            setItem: vi.fn(async (key: string, value: string) => {
                values.set(key, value)
            }),
            removeItem: vi.fn(async (key: string) => {
                values.delete(key)
            }),
            multiGet: vi.fn(async (keys: readonly string[]) => Object.fromEntries(
                keys.map(key => [key, values.get(key) ?? null]),
            )),
            multiSet: vi.fn(async (entries: Record<string, string>) => {
                Object.entries(entries).forEach(([key, value]) => values.set(key, value))
            }),
            multiRemove: vi.fn(async (keys: readonly string[]) => {
                keys.forEach(key => values.delete(key))
            }),
            getAllKeys: vi.fn(async () => Array.from(values.keys())),
            clear: vi.fn(async () => {
                values.clear()
            }),
        }
    }),
}))

vi.mock('../../src/turbomodules/stateStorage', () => ({
    createNativeStateStorage: createNativeStateStorageMock,
}))

import {
    createAssemblyStateStorage,
    resetAssemblyStateStorageForTests,
} from '../../src/platform-ports/stateStorage'

describe('assembly state storage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetAssemblyStateStorageForTests()
    })

    it('creates one adapter-backed native storage per assembly layer namespace', async () => {
        const stateStorage = createAssemblyStateStorage('state')
        const secureStateStorage = createAssemblyStateStorage('secure-state')

        await stateStorage.setItem('terminal.activation', 'active')
        await secureStateStorage.setItem('terminal.token', 'secret-token')

        expect(createNativeStateStorageMock).toHaveBeenCalledWith('mixc-catering-assembly-rn84::state')
        expect(createNativeStateStorageMock).toHaveBeenCalledWith('mixc-catering-assembly-rn84::secure-state')
        expect(await stateStorage.getItem('terminal.activation')).toBe('active')
        expect(await secureStateStorage.getItem('terminal.token')).toBe('secret-token')
        expect(await stateStorage.getItem('terminal.token')).toBeNull()
    })

    it('reuses the same storage instance for the same assembly layer', async () => {
        const first = createAssemblyStateStorage('state')
        const second = createAssemblyStateStorage('state')

        await first.setItem('runtime.node', 'master')

        expect(second).toBe(first)
        expect(await second.getItem('runtime.node')).toBe('master')
        expect(createNativeStateStorageMock).toHaveBeenCalledTimes(1)
    })

    it('keeps the existing topology gate when later callers reuse storage without options', async () => {
        let disabled = false
        const first = createAssemblyStateStorage('state', {
            shouldDisablePersistence: () => disabled,
        })
        const second = createAssemblyStateStorage('state')

        expect(second).toBe(first)

        await first.setItem('runtime.node', 'master')
        disabled = true

        await expect(second.getItem('runtime.node')).resolves.toBeNull()
    })

    it('delegates batch operations and clear to the native storage bridge', async () => {
        const stateStorage = createAssemblyStateStorage('state')

        await stateStorage.multiSet?.({
            'runtime.node': 'master',
            'runtime.display': '0',
        })

        await expect(stateStorage.multiGet?.([
            'runtime.node',
            'runtime.display',
            'runtime.missing',
        ])).resolves.toEqual({
            'runtime.node': 'master',
            'runtime.display': '0',
            'runtime.missing': null,
        })
        await expect(stateStorage.getAllKeys?.()).resolves.toEqual([
            'runtime.node',
            'runtime.display',
        ])

        await stateStorage.clear?.()

        await expect(stateStorage.getAllKeys?.()).resolves.toEqual([])
    })

    it('disables storage dynamically only when the topology gate is active', async () => {
        let disabled = false
        const stateStorage = createAssemblyStateStorage('state', {
            shouldDisablePersistence: () => disabled,
        })

        await stateStorage.setItem('terminal.activation', 'active')
        await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')

        disabled = true
        await stateStorage.setItem('terminal.activation', 'managed-secondary-write')

        await expect(stateStorage.getItem('terminal.activation')).resolves.toBeNull()
        await expect(stateStorage.getAllKeys?.()).resolves.toEqual([])
        await expect(stateStorage.multiGet?.([
            'terminal.activation',
            'terminal.missing',
        ])).resolves.toEqual({
            'terminal.activation': null,
            'terminal.missing': null,
        })

        disabled = false

        await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')
    })

    it('does not clear underlying storage while the topology gate is active', async () => {
        let disabled = false
        const stateStorage = createAssemblyStateStorage('state', {
            shouldDisablePersistence: () => disabled,
        })

        await stateStorage.setItem('terminal.activation', 'active')
        disabled = true
        await stateStorage.clear?.()
        await stateStorage.removeItem('terminal.activation')
        await stateStorage.multiRemove?.(['terminal.activation'])
        disabled = false

        await expect(stateStorage.getItem('terminal.activation')).resolves.toBe('active')
    })
})
