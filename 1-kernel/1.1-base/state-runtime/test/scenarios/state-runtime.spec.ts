import {describe, expect, it, vi} from 'vitest'
import {createSlice} from '@reduxjs/toolkit'
import {
    createModuleDisplayModeStateKeys,
    createModuleInstanceModeStateKeys,
    createModuleStateKeys,
    createModuleWorkspaceStateKeys,
    createDisplayModeActionDispatcher,
    createDisplayModeStateKeys,
    createInstanceModeActionDispatcher,
    createInstanceModeStateKeys,
    createScopedActionType,
    createScopedDispatchAction,
    createWorkspaceStateSlice,
    createScopedStateKey,
    createScopedStateDescriptors,
    createScopedStateKeys,
    createScopedStatePath,
    createSliceSyncDiff,
    createProtectedPersistenceStorageMissingError,
    applySliceSyncDiff,
    createSliceSyncSummary,
    createStateRuntime,
    createSyncStateSummary,
    createSyncTombstone,
    toWorkspaceStateDescriptors,
    createWorkspaceActionDispatcher,
    createWorkspaceStateKeys,
    getScopedStateKey,
    mergeSyncRecordState,
    stateRuntimeParameterDefinitions,
    type RootState,
    type StateRuntimeSliceDescriptor,
    type ValueWithUpdatedAt,
} from '../../src'

declare module '../../src' {
    interface RootState {
        'kernel.base.state-runtime.test.slice': {
            status: ValueWithUpdatedAt<string>
        }
    }
}

const createTestLogger = () => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    withContext() {
        return this
    },
    scope() {
        return this
    },
})

const createMemoryStorage = () => {
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
                return Object.fromEntries(
                    keys.map(key => [key, saved.get(key) ?? null]),
                )
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => {
                    saved.set(key, value)
                })
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
        },
    }
}

describe('state-runtime contracts', () => {
    it('allows packages to extend RootState via declaration merging', () => {
        const state = {
            'kernel.base.state-runtime.test.slice': {
                status: {
                    value: 'ready',
                    updatedAt: 1 as any,
                },
            },
        } satisfies RootState

        expect(state['kernel.base.state-runtime.test.slice'].status.value).toBe('ready')
    })

    it('exposes slice descriptors with persistence and sync intents', () => {
        const descriptor: StateRuntimeSliceDescriptor = {
            name: 'kernel.base.state-runtime.test.slice',
            persistIntent: 'owner-only',
            syncIntent: 'master-to-slave',
            persistence: [
                {
                    kind: 'field',
                    stateKey: 'status',
                    flushMode: 'immediate',
                },
            ],
        }

        expect(descriptor.persistIntent).toBe('owner-only')
        expect(descriptor.syncIntent).toBe('master-to-slave')
    })
})

describe('state-runtime store assembly', () => {
    it('registers reducers and exposes typed state snapshots', async () => {
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.counter',
            initialState: {count: 1},
            reducers: {
                increment: state => {
                    state.count += 1
                },
            },
        })

        const stateRuntime = createStateRuntime({
            runtimeName: 'state-runtime-test',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'never',
                    syncIntent: 'isolated',
                },
            ],
            logger: createTestLogger() as any,
        })

        await stateRuntime.hydratePersistence()
        const store = stateRuntime.getStore()
        store.dispatch(slice.actions.increment())

        const state = stateRuntime.getState() as unknown as Record<string, unknown>

        expect(state[slice.name]).toEqual({
            count: 2,
        })
    })

    it('automatically persists and restores field-level entries', async () => {
        const {saved, storage} = createMemoryStorage()
        const persistedSlice = createSlice({
            name: 'kernel.base.state-runtime.test.persisted',
            initialState: {value: 'seed'},
            reducers: {
                setValue: (state, action: {payload: string}) => {
                    state.value = action.payload
                },
            },
        })

        const runtimeA = createStateRuntime({
            runtimeName: 'state-runtime-persist-a',
            slices: [
                {
                    name: persistedSlice.name,
                    reducer: persistedSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-test',
            stateStorage: storage,
        })

        await runtimeA.hydratePersistence()
        runtimeA.getStore().dispatch(persistedSlice.actions.setValue('persisted'))
        await runtimeA.flushPersistence()

        expect(saved.get('state-runtime-test:kernel.base.state-runtime.test.persisted:value')).toBe(JSON.stringify('persisted'))

        const runtimeB = createStateRuntime({
            runtimeName: 'state-runtime-persist-b',
            slices: [
                {
                    name: persistedSlice.name,
                    reducer: persistedSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-test',
            stateStorage: storage,
        })

        await runtimeB.hydratePersistence()

        const state = runtimeB.getState() as Record<string, any>
        expect(state[persistedSlice.name]).toEqual({
            value: 'persisted',
        })
    })

    it('automatically removes persisted field entries when value becomes undefined', async () => {
        const {saved, storage} = createMemoryStorage()
        const persistedSlice = createSlice({
            name: 'kernel.base.state-runtime.test.persisted-removal',
            initialState: {value: 'seed' as string | undefined},
            reducers: {
                setValue: (state, action: {payload: string | undefined}) => {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-persist-removal',
            slices: [
                {
                    name: persistedSlice.name,
                    reducer: persistedSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-removal-test',
            stateStorage: storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(persistedSlice.actions.setValue('persisted'))
        await runtime.flushPersistence()

        expect(saved.get('state-runtime-removal-test:kernel.base.state-runtime.test.persisted-removal:value')).toBe(JSON.stringify('persisted'))

        runtime.getStore().dispatch(persistedSlice.actions.setValue(undefined))
        await runtime.flushPersistence()

        expect(saved.has('state-runtime-removal-test:kernel.base.state-runtime.test.persisted-removal:value')).toBe(false)
    })

    it('persists dynamic record entries via manifest keys', async () => {
        const {saved, storage} = createMemoryStorage()
        const dictionarySlice = createSlice({
            name: 'kernel.base.state-runtime.test.dictionary',
            initialState: {} as Record<string, {value: string}>,
            reducers: {
                put(state, action: {payload: {key: string; value: string}}) {
                    state[action.payload.key] = {value: action.payload.value}
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-record',
            slices: [
                {
                    name: dictionarySlice.name,
                    reducer: dictionarySlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'record',
                            storageKeyPrefix: 'records',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-record-test',
            stateStorage: storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(dictionarySlice.actions.put({key: 'A', value: '1'}))
        runtime.getStore().dispatch(dictionarySlice.actions.put({key: 'B', value: '2'}))
        await runtime.flushPersistence()

        expect(saved.get('state-runtime-record-test:kernel.base.state-runtime.test.dictionary:records:__manifest__')).toBe(JSON.stringify({
            entries: ['A', 'B'],
        }))
        expect(saved.get('state-runtime-record-test:kernel.base.state-runtime.test.dictionary:records:A')).toBe(JSON.stringify({value: '1'}))
        expect(saved.get('state-runtime-record-test:kernel.base.state-runtime.test.dictionary:records:B')).toBe(JSON.stringify({value: '2'}))
    })

    it('restores persisted record entries from manifest snapshots during hydrate', async () => {
        const {storage} = createMemoryStorage()
        const dictionarySlice = createSlice({
            name: 'kernel.base.state-runtime.test.dictionary-restore',
            initialState: {} as Record<string, {value: string}>,
            reducers: {
                put(state, action: {payload: {key: string; value: string}}) {
                    state[action.payload.key] = {value: action.payload.value}
                },
            },
        })
        const slices = [
            {
                name: dictionarySlice.name,
                reducer: dictionarySlice.reducer,
                persistIntent: 'owner-only' as const,
                syncIntent: 'isolated' as const,
                persistence: [
                    {
                        kind: 'record' as const,
                        storageKeyPrefix: 'records',
                        flushMode: 'immediate' as const,
                    },
                ],
            },
        ]

        const runtimeA = createStateRuntime({
            runtimeName: 'state-runtime-record-restore-a',
            slices,
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-record-restore-test',
            stateStorage: storage,
        })

        await runtimeA.hydratePersistence()
        runtimeA.getStore().dispatch(dictionarySlice.actions.put({key: 'A', value: '1'}))
        runtimeA.getStore().dispatch(dictionarySlice.actions.put({key: 'B', value: '2'}))
        await runtimeA.flushPersistence()

        const runtimeB = createStateRuntime({
            runtimeName: 'state-runtime-record-restore-b',
            slices,
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-record-restore-test',
            stateStorage: storage,
        })

        await runtimeB.hydratePersistence()

        expect((runtimeB.getState() as Record<string, any>)[dictionarySlice.name]).toEqual({
            A: {value: '1'},
            B: {value: '2'},
        })
    })

    it('routes protected entries to secureStateStorage', async () => {
        const plain = createMemoryStorage()
        const secure = createMemoryStorage()
        const secureSlice = createSlice({
            name: 'kernel.base.state-runtime.test.secure',
            initialState: {
                accessToken: 'seed',
            },
            reducers: {
                setToken(state, action: {payload: string}) {
                    state.accessToken = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-secure',
            slices: [
                {
                    name: secureSlice.name,
                    reducer: secureSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'accessToken',
                            protection: 'protected',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-secure-test',
            stateStorage: plain.storage,
            secureStateStorage: secure.storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(secureSlice.actions.setToken('token-1'))
        await runtime.flushPersistence()

        expect(plain.saved.size).toBe(0)
        expect(secure.saved.get('state-runtime-secure-test:kernel.base.state-runtime.test.secure:accessToken')).toBe(JSON.stringify('token-1'))
    })

    it('routes protected record manifests and entries to secureStateStorage', async () => {
        const plain = createMemoryStorage()
        const secure = createMemoryStorage()
        const secureSlice = createSlice({
            name: 'kernel.base.state-runtime.test.secure-record',
            initialState: {} as Record<string, {value: string}>,
            reducers: {
                put(state, action: {payload: {key: string; value: string}}) {
                    state[action.payload.key] = {value: action.payload.value}
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-secure-record',
            slices: [
                {
                    name: secureSlice.name,
                    reducer: secureSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'record',
                            storageKeyPrefix: 'records',
                            protection: 'protected',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-secure-record-test',
            stateStorage: plain.storage,
            secureStateStorage: secure.storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(secureSlice.actions.put({key: 'A', value: '1'}))
        await runtime.flushPersistence()

        expect(plain.saved.size).toBe(0)
        expect(secure.saved.get('state-runtime-secure-record-test:kernel.base.state-runtime.test.secure-record:records:__manifest__')).toBe(
            JSON.stringify({entries: ['A']}),
        )
        expect(secure.saved.get('state-runtime-secure-record-test:kernel.base.state-runtime.test.secure-record:records:A')).toBe(
            JSON.stringify({value: '1'}),
        )
    })

    it('throws a structured error when protected persistence storage is missing', async () => {
        const secureSlice = createSlice({
            name: 'kernel.base.state-runtime.test.secure-missing',
            initialState: {
                accessToken: 'seed',
            },
            reducers: {
                setToken(state, action: {payload: string}) {
                    state.accessToken = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-secure-missing',
            slices: [
                {
                    name: secureSlice.name,
                    reducer: secureSlice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'accessToken',
                            protection: 'protected',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-secure-missing-test',
            stateStorage: createMemoryStorage().storage,
        })

        await expect(runtime.hydratePersistence()).rejects.toMatchObject({
            key: 'kernel.base.state-runtime.protected_persistence_storage_missing',
            args: {
                runtimeName: 'state-runtime-secure-missing',
            },
            details: {
                phase: 'hydrate',
                sliceName: secureSlice.name,
            },
        })
    })

    it('exposes state runtime persistence defaults through parameter definitions', () => {
        expect(stateRuntimeParameterDefinitions.persistenceDebounceMs.defaultValue).toBe(16)
        expect(stateRuntimeParameterDefinitions.persistenceDebounceMs.validate?.(16)).toBe(true)
        expect(stateRuntimeParameterDefinitions.persistenceDebounceMs.validate?.(-1)).toBe(false)

        const appError = createProtectedPersistenceStorageMissingError('state-runtime-test')
        expect(appError).toMatchObject({
            key: 'kernel.base.state-runtime.protected_persistence_storage_missing',
            args: {
                runtimeName: 'state-runtime-test',
            },
        })
    })

    it('applies slice patches through the formal runtime API', async () => {
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.patchable',
            initialState: {
                value: 1,
                updatedAt: 10,
            },
            reducers: {},
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-patch-api',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'never',
                    syncIntent: 'isolated',
                },
            ],
            logger: createTestLogger() as any,
        })

        await runtime.hydratePersistence()
        runtime.applySlicePatches({
            [slice.name]: {
                value: 9,
                updatedAt: 20,
            },
        })

        expect((runtime.getState() as unknown as Record<string, unknown>)[slice.name]).toEqual({
            value: 9,
            updatedAt: 20,
        })
    })

    it('does not flush persistence before hydrate completes', async () => {
        const {saved, storage} = createMemoryStorage()
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.before-hydrate',
            initialState: {value: 'seed'},
            reducers: {
                setValue(state, action: {payload: string}) {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-before-hydrate',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-before-hydrate-test',
            stateStorage: storage,
        })

        runtime.getStore().dispatch(slice.actions.setValue('changed-before-hydrate'))
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(saved.size).toBe(0)
    })

    it('flushes immediate fields without waiting for debounce windows', async () => {
        const {saved, storage} = createMemoryStorage()
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.immediate',
            initialState: {value: 'seed'},
            reducers: {
                setValue(state, action: {payload: string}) {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-immediate',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-immediate-test',
            stateStorage: storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(slice.actions.setValue('persisted-now'))
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(saved.get('state-runtime-immediate-test:kernel.base.state-runtime.test.immediate:value')).toBe(
            JSON.stringify('persisted-now'),
        )
    })

    it('debounces repeated persistence writes into a single storage flush', async () => {
        vi.useFakeTimers()
        try {
            const memory = createMemoryStorage()
            let multiSetCalls = 0
            const baseStorage = memory.storage
            const trackedStorage = {
                ...baseStorage,
                async multiSet(entries: Readonly<Record<string, string>>) {
                    multiSetCalls += 1
                    await baseStorage.multiSet(entries)
                },
            }
            const slice = createSlice({
                name: 'kernel.base.state-runtime.test.debounced',
                initialState: {value: 'seed'},
                reducers: {
                    setValue(state, action: {payload: string}) {
                        state.value = action.payload
                    },
                },
            })

            const runtime = createStateRuntime({
                runtimeName: 'state-runtime-debounced',
                slices: [
                    {
                        name: slice.name,
                        reducer: slice.reducer,
                        persistIntent: 'owner-only',
                        syncIntent: 'isolated',
                        persistence: [
                            {
                                kind: 'field',
                                stateKey: 'value',
                                flushMode: 'debounced',
                            },
                        ],
                    },
                ],
                logger: createTestLogger() as any,
                allowPersistence: true,
                persistenceKey: 'state-runtime-debounced-test',
                stateStorage: trackedStorage,
                persistenceDebounceMs: 20,
            })

            await runtime.hydratePersistence()
            runtime.getStore().dispatch(slice.actions.setValue('value-1'))
            runtime.getStore().dispatch(slice.actions.setValue('value-2'))

            expect(multiSetCalls).toBe(0)

            await vi.advanceTimersByTimeAsync(19)
            expect(multiSetCalls).toBe(0)

            await vi.advanceTimersByTimeAsync(1)
            expect(multiSetCalls).toBe(1)
            expect(memory.saved.get('state-runtime-debounced-test:kernel.base.state-runtime.test.debounced:value')).toBe(
                JSON.stringify('value-2'),
            )
        } finally {
            vi.useRealTimers()
        }
    })

    it('skips persistence when shouldPersist returns false and export stays side-effect free', async () => {
        const memory = createMemoryStorage()
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.should-persist',
            initialState: {value: 'seed'},
            reducers: {
                setValue(state, action: {payload: string}) {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-should-persist',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                            shouldPersist: value => value !== 'skip-me',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-should-persist-test',
            stateStorage: memory.storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(slice.actions.setValue('skip-me'))

        const exported = await runtime.exportPersistedState()

        expect(exported.entries).toEqual([])
        expect(memory.saved.size).toBe(0)
        await runtime.flushPersistence()
        expect(memory.saved.size).toBe(0)
    })

    it('treats disabled persistence as a no-op for flush and hydrate', async () => {
        const memory = createMemoryStorage()
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.persistence-disabled',
            initialState: {value: 'seed'},
            reducers: {
                setValue(state, action: {payload: string}) {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-disabled',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: false,
            persistenceKey: 'state-runtime-disabled-test',
            stateStorage: memory.storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(slice.actions.setValue('changed'))

        await expect(runtime.flushPersistence()).resolves.toEqual({entries: []})
        expect(memory.saved.size).toBe(0)
    })

    it('resets redux state and clears persisted entries', async () => {
        const memory = createMemoryStorage()
        const slice = createSlice({
            name: 'kernel.base.state-runtime.test.resettable',
            initialState: {value: 'seed'},
            reducers: {
                setValue(state, action: {payload: string}) {
                    state.value = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-reset',
            slices: [
                {
                    name: slice.name,
                    reducer: slice.reducer,
                    persistIntent: 'owner-only',
                    syncIntent: 'isolated',
                    persistence: [
                        {
                            kind: 'field',
                            stateKey: 'value',
                            flushMode: 'immediate',
                        },
                    ],
                },
            ],
            logger: createTestLogger() as any,
            allowPersistence: true,
            persistenceKey: 'state-runtime-reset-test',
            stateStorage: memory.storage,
        })

        await runtime.hydratePersistence()
        runtime.getStore().dispatch(slice.actions.setValue('persisted'))
        await runtime.flushPersistence()
        expect(memory.saved.size).toBeGreaterThan(0)

        await runtime.resetState()
        await runtime.flushPersistence()

        expect((runtime.getState() as Record<string, any>)[slice.name]).toEqual({value: 'seed'})
        expect([...memory.saved.keys()]).toEqual([
            'state-runtime-reset-test:kernel.base.state-runtime.test.resettable:value',
        ])
        expect(memory.saved.get('state-runtime-reset-test:kernel.base.state-runtime.test.resettable:value'))
            .toBe(JSON.stringify('seed'))
    })

    it('merges sync record state by updatedAt and keeps tombstones explicit', () => {
        const merged = mergeSyncRecordState(
            {
                A: {value: 'local-a', updatedAt: 10 as any},
                B: {value: 'local-b', updatedAt: 20 as any},
            },
            {
                A: {value: 'remote-a', updatedAt: 5 as any},
                B: createSyncTombstone(30 as any),
                C: {value: 'remote-c', updatedAt: 40 as any},
            },
        )

        expect(merged.A).toEqual({value: 'local-a', updatedAt: 10})
        expect(merged.B).toEqual({updatedAt: 30, tombstone: true})
        expect(merged.C).toEqual({value: 'remote-c', updatedAt: 40})
    })

    it('builds sync summaries from updated envelopes only', () => {
        const summary = createSyncStateSummary({
            A: {value: 'a', updatedAt: 10},
            B: {updatedAt: 20, tombstone: true},
            C: {value: 'invalid'},
        })

        expect(summary).toEqual({
            A: {updatedAt: 10},
            B: {updatedAt: 20, tombstone: true},
        })
    })

    it('builds scoped keys without implicit string concatenation in callers', () => {
        expect(createModuleStateKeys('kernel.user.state', ['profile', 'session'] as const)).toEqual({
            profile: 'kernel.user.state.profile',
            session: 'kernel.user.state.session',
        })
        expect(createModuleWorkspaceStateKeys('kernel.user.state', ['order', 'draft'] as const)).toEqual({
            order: 'kernel.user.state.order',
            draft: 'kernel.user.state.draft',
        })
        expect(createModuleInstanceModeStateKeys('kernel.user.state', ['terminal', 'admin'] as const)).toEqual({
            terminal: 'kernel.user.state.terminal',
            admin: 'kernel.user.state.admin',
        })
        expect(createModuleDisplayModeStateKeys('kernel.user.state', ['primary', 'secondary'] as const)).toEqual({
            primary: 'kernel.user.state.primary',
            secondary: 'kernel.user.state.secondary',
        })

        expect(createScopedStateKey('kernel.user.state', {
            axis: 'workspace',
            value: 'main',
        })).toBe('kernel.user.state.main')

        expect(createScopedStatePath('kernel.user.state', [
            {axis: 'instanceMode', value: 'MASTER'},
            {axis: 'workspace', value: 'branch'},
        ])).toBe('kernel.user.state.MASTER.branch')

        expect(createScopedStateKeys('kernel.user.state', 'workspace', ['main', 'branch'] as const)).toEqual({
            main: 'kernel.user.state.main',
            branch: 'kernel.user.state.branch',
        })

        expect(createWorkspaceStateKeys('kernel.user.state', ['main', 'branch'] as const)).toEqual({
            main: 'kernel.user.state.main',
            branch: 'kernel.user.state.branch',
        })

        expect(createInstanceModeStateKeys('kernel.user.state', ['MASTER', 'SLAVE'] as const)).toEqual({
            MASTER: 'kernel.user.state.MASTER',
            SLAVE: 'kernel.user.state.SLAVE',
        })

        expect(createDisplayModeStateKeys('kernel.user.state', ['PRIMARY', 'SECONDARY'] as const)).toEqual({
            PRIMARY: 'kernel.user.state.PRIMARY',
            SECONDARY: 'kernel.user.state.SECONDARY',
        })

        expect(getScopedStateKey('kernel.user.state', [
            {axis: 'instanceMode', value: 'MASTER'},
            {axis: 'workspace', value: 'main'},
        ])).toBe('kernel.user.state.MASTER.main')
    })

    it('rewrites action types to scoped slice action types from route context', () => {
        const action = {
            type: 'kernel.user.state/setReady',
            payload: {ready: true},
        }

        expect(createScopedActionType(action.type, {
            axis: 'workspace',
            value: 'branch',
        })).toBe('kernel.user.state.branch/setReady')

        expect(createScopedDispatchAction(action, {
            axis: 'instanceMode',
            value: 'SLAVE',
        })).toEqual({
            type: 'kernel.user.state.SLAVE/setReady',
            payload: {ready: true},
        })
    })

    it('creates workspace and instance scoped action dispatchers from command route context', () => {
        const dispatchCalls: unknown[] = []
        const dispatch = (action: unknown) => {
            dispatchCalls.push(action)
            return action
        }

        const dispatchWorkspaceAction = createWorkspaceActionDispatcher({
            dispatch,
            routeContext: {
                workspace: 'branch',
            },
        })
        const dispatchInstanceModeAction = createInstanceModeActionDispatcher({
            dispatch,
            routeContext: {
                instanceMode: 'SLAVE',
            },
        })
        const dispatchDisplayModeAction = createDisplayModeActionDispatcher({
            dispatch,
            routeContext: {
                displayMode: 'SECONDARY',
            },
        })

        dispatchWorkspaceAction({
            type: 'kernel.user.state/setReady',
            payload: {ready: true},
        })
        dispatchInstanceModeAction({
            type: 'kernel.user.state/setReady',
            payload: {ready: false},
        })
        dispatchDisplayModeAction({
            type: 'kernel.user.state/setVisible',
            payload: {visible: true},
        })

        expect(dispatchCalls).toEqual([
            {
                type: 'kernel.user.state.branch/setReady',
                payload: {ready: true},
            },
            {
                type: 'kernel.user.state.SLAVE/setReady',
                payload: {ready: false},
            },
            {
                type: 'kernel.user.state.SECONDARY/setVisible',
                payload: {visible: true},
            },
        ])
    })

    it('throws explicit errors when scoped dispatch route context is missing', () => {
        expect(() => createWorkspaceActionDispatcher({
            dispatch: action => action,
            routeContext: {},
        })).toThrowError('[createWorkspaceActionDispatcher] routeContext.workspace is required')

        expect(() => createInstanceModeActionDispatcher({
            dispatch: action => action,
            routeContext: {},
        })).toThrowError('[createInstanceModeActionDispatcher] routeContext.instanceMode is required')
    })

    it('expands scoped state descriptors from a base descriptor factory', () => {
        const descriptors = createScopedStateDescriptors({
            baseName: 'kernel.user.state',
            axis: 'workspace',
            values: ['main', 'branch'],
            createDescriptor: (_value, scopedName) => ({
                name: scopedName,
                persistIntent: 'never',
                syncIntent: 'isolated',
            }),
        })

        expect(descriptors).toEqual([
            {
                name: 'kernel.user.state.main',
                persistIntent: 'never',
                syncIntent: 'isolated',
            },
            {
                name: 'kernel.user.state.branch',
                persistIntent: 'never',
                syncIntent: 'isolated',
            },
        ])
    })

    it('creates workspace scoped slices and descriptors for future business modules', () => {
        const slice = createWorkspaceStateSlice({
            baseName: 'kernel.user.state.order',
            values: ['MAIN', 'BRANCH'] as const,
            initialState: {
                orderType: {value: 'active', updatedAt: 0},
            },
            reducers: {
                setOrderType(state, action: {payload: {value: string; updatedAt: number}}) {
                    state.orderType = action.payload
                },
            },
        })

        expect(slice.sliceNames).toEqual({
            MAIN: 'kernel.user.state.order.MAIN',
            BRANCH: 'kernel.user.state.order.BRANCH',
        })

        const descriptors = toWorkspaceStateDescriptors(['MAIN', 'BRANCH'] as const, {
            name: slice.name,
            reducers: slice.reducers,
            persistIntent: 'owner-only',
            syncIntent: {
                MAIN: 'master-to-slave',
                BRANCH: 'slave-to-master',
            },
        })

        expect(descriptors).toEqual([
            {
                name: 'kernel.user.state.order.MAIN',
                reducer: slice.reducers.MAIN,
                persistIntent: 'owner-only',
                syncIntent: 'master-to-slave',
                persistence: undefined,
                sync: undefined,
            },
            {
                name: 'kernel.user.state.order.BRANCH',
                reducer: slice.reducers.BRANCH,
                persistIntent: 'owner-only',
                syncIntent: 'slave-to-master',
                persistence: undefined,
                sync: undefined,
            },
        ])
    })

    it('treats object-shaped sync descriptors as plain values instead of scope maps', () => {
        const slice = createWorkspaceStateSlice({
            baseName: 'kernel.user.state.syncable',
            values: ['MAIN', 'BRANCH'] as const,
            initialState: {
                items: {},
            },
            reducers: {},
        })

        const descriptors = toWorkspaceStateDescriptors(['MAIN', 'BRANCH'] as const, {
            name: slice.name,
            reducers: slice.reducers,
            sync: {
                kind: 'record',
            },
        })

        expect(descriptors).toEqual([
            {
                name: 'kernel.user.state.syncable.MAIN',
                reducer: slice.reducers.MAIN,
                persistIntent: 'never',
                syncIntent: 'isolated',
                persistence: undefined,
                sync: {
                    kind: 'record',
                },
            },
            {
                name: 'kernel.user.state.syncable.BRANCH',
                reducer: slice.reducers.BRANCH,
                persistIntent: 'never',
                syncIntent: 'isolated',
                persistence: undefined,
                sync: {
                    kind: 'record',
                },
            },
        ])
    })

    it('supports old business-style workspace scoped selectors without global getters', async () => {
        interface OrderCreationState {
            orderCreationType: ValueWithUpdatedAt<string | undefined>
            selectedPayingOrder: ValueWithUpdatedAt<string | null>
        }

        const initialOrderCreationState: OrderCreationState = {
            orderCreationType: {
                value: undefined,
                updatedAt: 0 as any,
            },
            selectedPayingOrder: {
                value: null,
                updatedAt: 0 as any,
            },
        }

        const slice = createWorkspaceStateSlice({
            baseName: 'kernel.trade.state.orderCreation',
            values: ['MAIN', 'BRANCH'] as const,
            initialState: initialOrderCreationState,
            reducers: {
                setOrderCreationType(state, action: {payload: ValueWithUpdatedAt<string | undefined>}) {
                    state.orderCreationType = action.payload
                },
                setSelectedPayingOrder(state, action: {payload: ValueWithUpdatedAt<string | null>}) {
                    state.selectedPayingOrder = action.payload
                },
            },
        })

        const runtime = createStateRuntime({
            runtimeName: 'state-runtime-workspace-business-selector',
            slices: toWorkspaceStateDescriptors(['MAIN', 'BRANCH'] as const, {
                name: slice.name,
                reducers: slice.reducers,
                persistIntent: 'never',
                syncIntent: 'master-to-slave',
            }),
            logger: createTestLogger() as any,
        })

        await runtime.hydratePersistence()
        const dispatchBranchAction = createWorkspaceActionDispatcher({
            dispatch: action => runtime.getStore().dispatch(action),
            routeContext: {
                workspace: 'BRANCH',
            },
        })

        dispatchBranchAction(slice.actions.setOrderCreationType({
            value: 'refund',
            updatedAt: 10 as any,
        }))
        dispatchBranchAction(slice.actions.setSelectedPayingOrder({
            value: 'PAY-1',
            updatedAt: 11 as any,
        }))

        const selectOrderCreationState = (
            state: Record<string, unknown>,
            workspace: string,
        ) => {
            const stateKey = getScopedStateKey(slice.name, [{
                axis: 'workspace',
                value: workspace,
            }])
            return state[stateKey] as OrderCreationState | undefined
        }

        const state = runtime.getState() as unknown as Record<string, unknown>
        const branchOrderCreationState = selectOrderCreationState(state, 'BRANCH')
        const mainOrderCreationState = selectOrderCreationState(state, 'MAIN')

        expect(branchOrderCreationState?.orderCreationType.value).toBe('refund')
        expect(branchOrderCreationState?.selectedPayingOrder.value).toBe('PAY-1')
        expect(mainOrderCreationState?.orderCreationType.value).toBeUndefined()
        expect(mainOrderCreationState?.selectedPayingOrder.value).toBeNull()
    })

    it('supports old business-style ValueWithUpdatedAt record filtering', () => {
        interface PaymentFunction {
            key: string
            instanceMode: readonly string[]
        }

        const paymentFunctionState: Record<string, ValueWithUpdatedAt<PaymentFunction | undefined>> = {
            cash: {
                value: {
                    key: 'cash',
                    instanceMode: ['MASTER', 'SLAVE'],
                },
                updatedAt: 1 as any,
            },
            card: {
                value: {
                    key: 'card',
                    instanceMode: ['MASTER'],
                },
                updatedAt: 2 as any,
            },
            disabled: {
                value: undefined,
                updatedAt: 3 as any,
            },
        }

        const selectPaymentFunctions = (
            state: Record<string, ValueWithUpdatedAt<PaymentFunction | undefined>>,
            currentInstanceMode: string,
        ) => Object.values(state)
            .map(wrapper => wrapper.value)
            .filter((paymentFunction): paymentFunction is PaymentFunction =>
                paymentFunction != null && Array.isArray(paymentFunction.instanceMode),
            )
            .filter(paymentFunction => paymentFunction.instanceMode.includes(currentInstanceMode))

        expect(selectPaymentFunctions(paymentFunctionState, 'SLAVE')).toEqual([
            {
                key: 'cash',
                instanceMode: ['MASTER', 'SLAVE'],
            },
        ])
        expect(selectPaymentFunctions(paymentFunctionState, 'MASTER')).toEqual([
            {
                key: 'cash',
                instanceMode: ['MASTER', 'SLAVE'],
            },
            {
                key: 'card',
                instanceMode: ['MASTER'],
            },
        ])
    })

    it('creates slice sync summary and connection diff from record descriptors', () => {
        const descriptor: StateRuntimeSliceDescriptor<Record<string, any>> = {
            name: 'kernel.base.state-runtime.test.sync-record',
            persistIntent: 'never',
            syncIntent: 'master-to-slave',
            sync: {
                kind: 'record',
            },
        }
        const state = {
            A: {value: 'local-newer', updatedAt: 30},
            B: {value: 'local-older', updatedAt: 10},
            C: {value: 'local-only', updatedAt: 40},
        }

        expect(createSliceSyncSummary(descriptor, state)).toEqual({
            A: {updatedAt: 30},
            B: {updatedAt: 10},
            C: {updatedAt: 40},
        })

        expect(createSliceSyncDiff(descriptor, state, {
            A: {updatedAt: 20},
            B: {updatedAt: 50},
            D: {updatedAt: 60},
        })).toEqual([
            {
                key: 'A',
                value: {value: 'local-newer', updatedAt: 30},
            },
            {
                key: 'D',
                value: {updatedAt: 60, tombstone: true},
            },
            {
                key: 'C',
                value: {value: 'local-only', updatedAt: 40},
            },
        ])
    })

    it('applies slice sync diff by updatedAt and consumes tombstones as deletions', () => {
        const descriptor: StateRuntimeSliceDescriptor<Record<string, any>> = {
            name: 'kernel.base.state-runtime.test.sync-apply',
            persistIntent: 'never',
            syncIntent: 'master-to-slave',
            sync: {
                kind: 'record',
            },
        }

        const next = applySliceSyncDiff(descriptor, {
            A: {value: 'local-old', updatedAt: 10},
            B: {value: 'local-keep', updatedAt: 30},
        }, [
            {
                key: 'A',
                value: {value: 'remote-new', updatedAt: 20},
            },
            {
                key: 'B',
                value: {updatedAt: 40, tombstone: true},
            },
            {
                key: 'C',
                value: {value: 'remote-add', updatedAt: 50},
            },
        ])

        expect(next).toEqual({
            A: {value: 'remote-new', updatedAt: 20},
            C: {value: 'remote-add', updatedAt: 50},
        })
    })
})
