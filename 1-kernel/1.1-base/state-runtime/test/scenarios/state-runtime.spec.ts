import {describe, expect, it} from 'vitest'
import {createSlice} from '@reduxjs/toolkit'
import {
    createDisplayModeStateKeys,
    createInstanceModeStateKeys,
    createScopedStateKey,
    createScopedStateDescriptors,
    createScopedStateKeys,
    createScopedStatePath,
    createSliceSyncDiff,
    applySliceSyncDiff,
    createSliceSyncSummary,
    createStateRuntime,
    createSyncStateSummary,
    createSyncTombstone,
    createWorkspaceStateKeys,
    getScopedStateKey,
    mergeSyncRecordState,
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

        const state = stateRuntime.getState() as Record<string, unknown>

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

        expect((runtime.getState() as Record<string, unknown>)[slice.name]).toEqual({
            value: 9,
            updatedAt: 20,
        })
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
