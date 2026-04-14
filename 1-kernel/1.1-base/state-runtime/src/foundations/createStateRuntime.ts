import type {
    LoggerPort,
    StateStoragePort,
} from '@impos2/kernel-base-platform-ports'
import type {RootState} from '../types/state'
import type {CreateStateRuntimeInput, StateRuntime} from '../types/runtime'
import type {
    PersistedStateEntrySnapshot,
    PersistedStateRuntimeSnapshot,
    StateRuntimePersistenceDescriptor,
    StateRuntimePersistenceFieldDescriptor,
    StateRuntimePersistenceRecordDescriptor,
} from '../types/persistence'
import {createReplaceStateRuntimeAction, createStateStore} from './store'
import {
    createProtectedPersistenceStorageMissingError,
    stateRuntimeParameterDefinitions,
} from '../supports'

const NOOP_LOGGER: LoggerPort = {
    emit() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    scope() {
        return this
    },
    withContext() {
        return this
    },
}

type PersistableStorageKind = 'plain' | 'protected'

interface PersistableEntry {
    sliceName: string
    stateKey: string
    storageKey: string
    value: unknown
    storageKind: PersistableStorageKind
}

interface PersistedRecordManifest {
    entries: string[]
}

const RECORD_MANIFEST_SUFFIX = '__manifest__'

const createSliceStoragePrefix = (
    persistenceKey: string,
    sliceName: string,
) => `${persistenceKey}:${sliceName}`

const createFieldStorageKey = (
    persistenceKey: string,
    sliceName: string,
    descriptor: StateRuntimePersistenceFieldDescriptor,
) => `${createSliceStoragePrefix(persistenceKey, sliceName)}:${descriptor.storageKey ?? descriptor.stateKey}`

const createRecordStoragePrefix = (
    persistenceKey: string,
    sliceName: string,
    descriptor: StateRuntimePersistenceRecordDescriptor,
) => `${createSliceStoragePrefix(persistenceKey, sliceName)}:${descriptor.storageKeyPrefix ?? 'entries'}`

const createRecordManifestKey = (
    persistenceKey: string,
    sliceName: string,
    descriptor: StateRuntimePersistenceRecordDescriptor,
) => `${createRecordStoragePrefix(persistenceKey, sliceName, descriptor)}:${RECORD_MANIFEST_SUFFIX}`

const createRecordEntryKey = (
    persistenceKey: string,
    sliceName: string,
    descriptor: StateRuntimePersistenceRecordDescriptor,
    entryKey: string,
) => `${createRecordStoragePrefix(persistenceKey, sliceName, descriptor)}:${entryKey}`

const toRecordEntries = (
    descriptor: StateRuntimePersistenceRecordDescriptor,
    sliceState: Record<string, unknown>,
) => descriptor.getEntries?.(sliceState) ?? sliceState

const cloneState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const encodeEntry = (value: unknown) => JSON.stringify(value)

const decodeEntry = (raw: string | null): unknown => {
    if (raw == null) {
        return undefined
    }
    return JSON.parse(raw)
}

const getStoragePort = (
    input: CreateStateRuntimeInput,
    storageKind: PersistableStorageKind,
): StateStoragePort | undefined => {
    if (storageKind === 'protected') {
        return input.secureStateStorage
    }
    return input.stateStorage
}

export const createStateRuntime = (
    input: CreateStateRuntimeInput,
): StateRuntime => {
    const store = createStateStore(input.slices)
    const logger = input.logger ?? NOOP_LOGGER
    const persistenceEnabled = Boolean(
        input.persistenceKey && input.allowPersistence !== false,
    )
    const persistedValueCache = new Map<string, string>()
    const persistedStorageKindCache = new Map<string, PersistableStorageKind>()
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    let persistenceChain = Promise.resolve()
    let hydrated = false
    let persistenceDirty = false
    const persistenceDebounceMs =
        input.persistenceDebounceMs ?? stateRuntimeParameterDefinitions.persistenceDebounceMs.defaultValue

    const persistableSlices = input.slices.filter(
        slice => slice.persistIntent === 'owner-only' && (slice.persistence?.length ?? 0) > 0,
    )

    logger.info({
        category: 'runtime.load',
        event: 'state-runtime-created',
        message: `load ${input.runtimeName}`,
        data: {
            slices: input.slices.map(slice => slice.name),
            persistableSlices: persistableSlices.map(slice => slice.name),
            persistenceEnabled,
        },
    })

    const exportEntries = (): PersistableEntry[] => {
        if (!persistenceEnabled || !input.persistenceKey) {
            return []
        }

        const state = store.getState() as Record<string, unknown>
        const entries: PersistableEntry[] = []

        for (const slice of persistableSlices) {
            const sliceState = state[slice.name]
            if (sliceState == null) {
                continue
            }

            for (const descriptor of slice.persistence ?? []) {
                if (descriptor.kind === 'field') {
                    const value = (sliceState as Record<string, unknown>)[descriptor.stateKey]
                    const shouldPersist = descriptor.shouldPersist?.(value, sliceState) ?? value !== undefined
                    if (!shouldPersist) {
                        continue
                    }

                    entries.push({
                        sliceName: slice.name,
                        stateKey: descriptor.stateKey,
                        storageKey: createFieldStorageKey(input.persistenceKey, slice.name, descriptor),
                        value,
                        storageKind: descriptor.protection === 'protected' ? 'protected' : 'plain',
                    })
                    continue
                }

                const recordEntries = toRecordEntries(
                    descriptor,
                    sliceState as Record<string, unknown>,
                )
                for (const [entryKey, entryValue] of Object.entries(recordEntries)) {
                    const shouldPersistEntry = descriptor.shouldPersistEntry?.(
                        entryKey,
                        entryValue,
                        sliceState as Record<string, unknown>,
                    ) ?? entryValue !== undefined
                    if (!shouldPersistEntry) {
                        continue
                    }

                    entries.push({
                        sliceName: slice.name,
                        stateKey: entryKey,
                        storageKey: createRecordEntryKey(
                            input.persistenceKey,
                            slice.name,
                            descriptor,
                            entryKey,
                        ),
                        value: entryValue,
                        storageKind: descriptor.protection === 'protected' ? 'protected' : 'plain',
                    })
                }
            }
        }

        return entries
    }

    const exportPersistedState = async (): Promise<PersistedStateRuntimeSnapshot> => {
        const entries = exportEntries()
        return {
            entries: entries.map<PersistedStateEntrySnapshot>(entry => ({
                key: entry.storageKey,
                value: cloneState(entry.value),
                protected: entry.storageKind === 'protected',
            })),
        }
    }

    const buildStatePatchFromSnapshot = (
        snapshot: PersistedStateRuntimeSnapshot,
    ): Record<string, unknown> => {
        const slicePatchMap = new Map<string, Record<string, unknown>>()

        for (const slice of persistableSlices) {
            const slicePatch: Record<string, unknown> = {}
            const descriptors = slice.persistence ?? []

            for (const descriptor of descriptors) {
                if (descriptor.kind === 'field') {
                    const storageKey = createFieldStorageKey(input.persistenceKey!, slice.name, descriptor)
                    const match = snapshot.entries.find(entry => entry.key === storageKey)
                    if (match) {
                        slicePatch[descriptor.stateKey] = cloneState(match.value)
                    }
                    continue
                }

                const recordPrefix = `${createRecordStoragePrefix(input.persistenceKey!, slice.name, descriptor)}:`
                for (const entry of snapshot.entries) {
                    if (entry.key.startsWith(recordPrefix) && !entry.key.endsWith(RECORD_MANIFEST_SUFFIX)) {
                        const entryKey = entry.key.slice(recordPrefix.length)
                        slicePatch[entryKey] = cloneState(entry.value)
                    }
                }
            }

            if (Object.keys(slicePatch).length > 0) {
                slicePatchMap.set(slice.name, slicePatch)
            }
        }

        return Object.fromEntries(slicePatchMap.entries())
    }

    const markPersistenceDirty = () => {
        persistenceDirty = true
    }

    const clearPersistenceDirty = () => {
        persistenceDirty = false
    }

    const applyPersistedState = (snapshot: PersistedStateRuntimeSnapshot) => {
        store.dispatch(createReplaceStateRuntimeAction(buildStatePatchFromSnapshot(snapshot)))
        clearPersistenceDirty()
    }

    const applySlicePatches = (slices: Record<string, unknown>) => {
        if (Object.keys(slices).length === 0) {
            return
        }

        store.dispatch(createReplaceStateRuntimeAction(slices))
        clearPersistenceDirty()
    }

    const removeKeys = async (
        storage: StateStoragePort,
        keys: readonly string[],
    ) => {
        if (keys.length === 0) {
            return
        }
        if (storage.multiRemove) {
            await storage.multiRemove(keys)
            return
        }
        await Promise.all(keys.map(key => storage.removeItem(key)))
    }

    const setEntries = async (
        storage: StateStoragePort,
        entries: Readonly<Record<string, string>>,
    ) => {
        const keys = Object.keys(entries)
        if (keys.length === 0) {
            return
        }
        if (storage.multiSet) {
            await storage.multiSet(entries)
            return
        }
        await Promise.all(
            keys.map(key => storage.setItem(key, entries[key]!)),
        )
    }

    const flushPersistence = async (): Promise<PersistedStateRuntimeSnapshot> => {
        if (!persistenceEnabled || !input.persistenceKey) {
            return {
                entries: [],
            }
        }

        const snapshot = await exportPersistedState()
        const currentEntries = exportEntries()

        persistenceChain = persistenceChain.then(async () => {
            const nextPlainEntries: Record<string, string> = {}
            const nextProtectedEntries: Record<string, string> = {}
            const nextKeys = new Set<string>()
            const nextStorageKinds = new Map<string, PersistableStorageKind>()

            for (const entry of currentEntries) {
                const encoded = encodeEntry(entry.value)
                nextKeys.add(entry.storageKey)
                nextStorageKinds.set(entry.storageKey, entry.storageKind)
                if (entry.storageKind === 'protected') {
                    nextProtectedEntries[entry.storageKey] = encoded
                } else {
                    nextPlainEntries[entry.storageKey] = encoded
                }
            }

            for (const slice of persistableSlices) {
                for (const descriptor of slice.persistence ?? []) {
                    if (descriptor.kind !== 'record') {
                        continue
                    }

                    const manifestKey = createRecordManifestKey(input.persistenceKey!, slice.name, descriptor)
                    const manifestEntries = currentEntries
                        .filter(entry => entry.sliceName === slice.name && entry.storageKey.startsWith(`${createRecordStoragePrefix(input.persistenceKey!, slice.name, descriptor)}:`))
                        .map(entry => entry.storageKey.slice(`${createRecordStoragePrefix(input.persistenceKey!, slice.name, descriptor)}:`.length))
                        .filter(entryKey => entryKey !== RECORD_MANIFEST_SUFFIX)

                    const manifestEncoded = encodeEntry({
                        entries: manifestEntries,
                    } satisfies PersistedRecordManifest)

                    const storageKind = descriptor.protection === 'protected' ? 'protected' : 'plain'
                    nextKeys.add(manifestKey)
                    nextStorageKinds.set(manifestKey, storageKind)
                    if (storageKind === 'protected') {
                        nextProtectedEntries[manifestKey] = manifestEncoded
                    } else {
                        nextPlainEntries[manifestKey] = manifestEncoded
                    }
                }
            }

            const plainStorage = getStoragePort(input, 'plain')
            const protectedStorage = getStoragePort(input, 'protected')

            if (Object.keys(nextProtectedEntries).length > 0 && !protectedStorage) {
                throw createProtectedPersistenceStorageMissingError(input.runtimeName, {
                    phase: 'flush',
                    protectedKeys: Object.keys(nextProtectedEntries),
                })
            }

            const stalePlainKeys = [...persistedValueCache.keys()].filter(
                key =>
                    persistedStorageKindCache.get(key) === 'plain'
                    && (
                        !nextKeys.has(key)
                        || nextStorageKinds.get(key) === 'protected'
                    ),
            )
            const staleProtectedKeys = [...persistedValueCache.keys()].filter(
                key =>
                    persistedStorageKindCache.get(key) === 'protected'
                    && (
                        !nextKeys.has(key)
                        || nextStorageKinds.get(key) === 'plain'
                    ),
            )

            if (plainStorage) {
                await removeKeys(plainStorage, stalePlainKeys)
                await setEntries(plainStorage, nextPlainEntries)
            }
            if (protectedStorage) {
                await removeKeys(protectedStorage, staleProtectedKeys)
                await setEntries(protectedStorage, nextProtectedEntries)
            }

            persistedValueCache.clear()
            persistedStorageKindCache.clear()

            for (const [key, value] of Object.entries(nextPlainEntries)) {
                persistedValueCache.set(key, value)
                persistedStorageKindCache.set(key, 'plain')
            }
            for (const [key, value] of Object.entries(nextProtectedEntries)) {
                persistedValueCache.set(key, value)
                persistedStorageKindCache.set(key, 'protected')
            }
        })

        await persistenceChain
        clearPersistenceDirty()
        return snapshot
    }

    const scheduleFlush = (mode: 'immediate' | 'debounced') => {
        if (!persistenceEnabled) {
            return
        }

        if (mode === 'immediate') {
            void flushPersistence()
            return
        }

        if (flushTimer) {
            clearTimeout(flushTimer)
        }
        flushTimer = setTimeout(() => {
            flushTimer = null
            void flushPersistence()
        }, persistenceDebounceMs)
    }

    const collectPersistenceModes = (
        state: Record<string, unknown>,
        changedSliceNames: readonly string[],
    ): ('immediate' | 'debounced')[] => {
        const changed = new Set(changedSliceNames)
        const modes = new Set<'immediate' | 'debounced'>()

        for (const slice of persistableSlices) {
            if (!changed.has(slice.name)) {
                continue
            }

            const sliceState = state[slice.name]
            if (sliceState == null) {
                for (const descriptor of slice.persistence ?? []) {
                    modes.add(descriptor.flushMode ?? 'debounced')
                }
                continue
            }

            for (const descriptor of slice.persistence ?? []) {
                if (descriptor.kind === 'field') {
                    const value = (sliceState as Record<string, unknown>)[descriptor.stateKey]
                    const shouldPersist = descriptor.shouldPersist?.(value, sliceState) ?? value !== undefined
                    if (shouldPersist || persistedValueCache.has(
                        createFieldStorageKey(input.persistenceKey!, slice.name, descriptor),
                    )) {
                        modes.add(descriptor.flushMode ?? 'debounced')
                    }
                    continue
                }

                const recordEntries = toRecordEntries(descriptor, sliceState as Record<string, unknown>)
                const manifestKey = createRecordManifestKey(input.persistenceKey!, slice.name, descriptor)
                if (
                    Object.keys(recordEntries).length > 0
                    || persistedValueCache.has(manifestKey)
                ) {
                    modes.add(descriptor.flushMode ?? 'debounced')
                }
            }
        }

        return [...modes]
    }

    const hydratePersistence = async () => {
        if (!persistenceEnabled || !input.persistenceKey || hydrated) {
            return
        }

        const entries: PersistedStateEntrySnapshot[] = []

        for (const slice of persistableSlices) {
            for (const descriptor of slice.persistence ?? []) {
                const storageKind = descriptor.protection === 'protected' ? 'protected' : 'plain'
                const storage = getStoragePort(input, storageKind)

                if (!storage) {
                    if (storageKind === 'protected') {
                        throw createProtectedPersistenceStorageMissingError(input.runtimeName, {
                            phase: 'hydrate',
                            sliceName: slice.name,
                        })
                    }
                    continue
                }

                if (descriptor.kind === 'field') {
                    const storageKey = createFieldStorageKey(input.persistenceKey, slice.name, descriptor)
                    const raw = await storage.getItem(storageKey)
                    if (raw != null) {
                        entries.push({
                            key: storageKey,
                            value: decodeEntry(raw),
                            protected: storageKind === 'protected',
                        })
                        persistedValueCache.set(storageKey, raw)
                        persistedStorageKindCache.set(storageKey, storageKind)
                    }
                    continue
                }

                const manifestKey = createRecordManifestKey(input.persistenceKey, slice.name, descriptor)
                const manifestRaw = await storage.getItem(manifestKey)
                if (manifestRaw != null) {
                    persistedValueCache.set(manifestKey, manifestRaw)
                    persistedStorageKindCache.set(manifestKey, storageKind)
                }
                const manifest = decodeEntry(manifestRaw) as PersistedRecordManifest | undefined
                for (const entryKey of manifest?.entries ?? []) {
                    const storageKey = createRecordEntryKey(
                        input.persistenceKey,
                        slice.name,
                        descriptor,
                        entryKey,
                    )
                    const raw = await storage.getItem(storageKey)
                    if (raw == null) {
                        continue
                    }
                    entries.push({
                        key: storageKey,
                        value: decodeEntry(raw),
                        protected: storageKind === 'protected',
                    })
                    persistedValueCache.set(storageKey, raw)
                    persistedStorageKindCache.set(storageKey, storageKind)
                }
            }
        }

        if (entries.length > 0) {
            applyPersistedState({entries})
        }

        hydrated = true
        clearPersistenceDirty()
    }

    const previousPersistableSliceRefs = new Map<string, unknown>()
    for (const slice of persistableSlices) {
        previousPersistableSliceRefs.set(slice.name, (store.getState() as Record<string, unknown>)[slice.name])
    }

    store.subscribe(() => {
        if (!persistenceEnabled || !hydrated) {
            return
        }

        const state = store.getState() as Record<string, unknown>
        const changedSliceNames: string[] = []

        for (const slice of persistableSlices) {
            const currentRef = state[slice.name]
            if (previousPersistableSliceRefs.get(slice.name) !== currentRef) {
                previousPersistableSliceRefs.set(slice.name, currentRef)
                changedSliceNames.push(slice.name)
            }
        }

        if (changedSliceNames.length === 0) {
            return
        }

        markPersistenceDirty()
        const modes = collectPersistenceModes(state, changedSliceNames)
        if (!persistenceDirty || modes.length === 0) {
            return
        }

        if (modes.includes('immediate')) {
            scheduleFlush('immediate')
        } else if (modes.includes('debounced')) {
            scheduleFlush('debounced')
        }
    })

    return {
        getStore() {
            return store
        },
        getState() {
            return store.getState() as RootState
        },
        getSlices() {
            return input.slices
        },
        applySlicePatches,
        exportPersistedState,
        applyPersistedState,
        hydratePersistence,
        flushPersistence,
    }
}
