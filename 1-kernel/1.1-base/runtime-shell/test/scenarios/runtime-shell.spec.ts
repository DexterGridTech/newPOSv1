import {
    createEnvelopeId,
    createNodeId,
    createRequestId,
    createSessionId,
    type StateSyncDiffEnvelope,
} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {describe, expect, it} from 'vitest'
import {createPlatformPorts, createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createKernelRuntime,
    selectErrorCatalogEntry,
    selectParameterCatalogEntry,
    selectRequestProjection,
} from '../../src'
import type {KernelRuntimeModule} from '../../src'

const APP_COUNTER_SLICE = 'kernel.base.runtime-shell.test.app-counter'

const appCounterSlice = createSlice({
    name: APP_COUNTER_SLICE,
    initialState: {
        value: 0,
        updatedAt: 0,
    },
    reducers: {
        setCounter(state, action: PayloadAction<{value: number; updatedAt: number}>) {
            state.value = action.payload.value
            state.updatedAt = action.payload.updatedAt
        },
    },
})

const appCounterStateSlice: StateRuntimeSliceDescriptor<Record<string, unknown>> = {
    name: APP_COUNTER_SLICE,
    reducer: appCounterSlice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {
            kind: 'field',
            stateKey: 'value',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'updatedAt',
            flushMode: 'immediate',
        },
    ],
    sync: {
        kind: 'record',
        getEntries: state => ({
            counter: {
                value: {
                    value: (state as {value: number}).value,
                    updatedAt: (state as {updatedAt: number}).updatedAt,
                },
                updatedAt: (state as {updatedAt: number}).updatedAt,
            },
        }),
        applyEntries: (_state, entries) => {
            const counter = entries.counter
            if (!counter || counter.tombstone === true || !counter.value || typeof counter.value !== 'object') {
                return {
                    value: 0,
                    updatedAt: 0,
                }
            }

            const nextValue = counter.value as {
                value?: number
                updatedAt?: number
            }

            return {
                value: nextValue.value ?? 0,
                updatedAt: nextValue.updatedAt ?? counter.updatedAt,
            }
        },
    },
}

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
                return Object.fromEntries(keys.map(key => [key, saved.get(key) ?? null]))
            },
            async multiSet(entries: Readonly<Record<string, string>>) {
                Object.entries(entries).forEach(([key, value]) => saved.set(key, value))
            },
            async multiRemove(keys: readonly string[]) {
                keys.forEach(key => saved.delete(key))
            },
        },
    }
}

const createDemoModule = (lifecyclePhases: string[]): KernelRuntimeModule => ({
    moduleName: 'kernel.base.runtime-shell.test-module',
    packageVersion: '0.0.1',
    stateSlices: [appCounterStateSlice],
    errorDefinitions: [
        {
            key: 'kernel.base.runtime-shell.test.error',
            name: 'Runtime Shell Test Error',
            defaultTemplate: 'runtime shell test error',
            category: 'SYSTEM',
            severity: 'LOW',
            moduleName: 'kernel.base.runtime-shell.test-module',
        },
    ],
    parameterDefinitions: [
        {
            key: 'kernel.base.runtime-shell.test.parameter',
            name: 'Runtime Shell Test Parameter',
            defaultValue: 7,
            valueType: 'number',
            moduleName: 'kernel.base.runtime-shell.test-module',
        },
    ],
    hostBootstrap() {
        lifecyclePhases.push('host-bootstrap')
    },
    install(context) {
        lifecyclePhases.push('install')

        context.registerHandler('kernel.base.runtime-shell.test.initialize', async handlerContext => {
            lifecyclePhases.push('initialize-handler')
            return {
                initialized: handlerContext.command.internal === true,
            }
        })

        context.registerHandler('kernel.base.runtime-shell.test.echo', async handlerContext => {
            lifecyclePhases.push('execute-handler')
            handlerContext.dispatchAction(appCounterSlice.actions.setCounter({
                value: 1,
                updatedAt: 123,
            }))
            return {
                payload: handlerContext.command.payload,
            }
        })
    },
    initializeCommands: [
        {
            commandName: 'kernel.base.runtime-shell.test.initialize',
            payload: {boot: true},
        },
    ],
})

describe('runtime-shell', () => {
    it('loads modules, exposes unified root state, persists data, and restores projections', async () => {
        const lifecyclePhases: string[] = []
        const logEvents: Array<{event?: string; message?: string}> = []
        const persistedStorage = createMemoryStorage()
        const runtimeNodeId = createNodeId()
        const demoModule = createDemoModule(lifecyclePhases)

        const runtime = createKernelRuntime({
            localNodeId: runtimeNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write: event => {
                        logEvents.push({event: event.event, message: event.message})
                    },
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test',
                        layer: 'kernel',
                    },
                }),
                stateStorage: persistedStorage.storage,
            }),
            modules: [demoModule],
            startupSeed: {
                errorCatalog: {
                    'kernel.base.runtime-shell.test.error': {
                        key: 'kernel.base.runtime-shell.test.error',
                        template: 'runtime shell test error persisted',
                        updatedAt: 99 as any,
                        source: 'user',
                    },
                },
                parameterCatalog: {
                    'kernel.base.runtime-shell.test.parameter': {
                        key: 'kernel.base.runtime-shell.test.parameter',
                        rawValue: 88,
                        updatedAt: 100 as any,
                        source: 'user',
                    },
                },
            },
        })

        await runtime.start()

        expect(logEvents.some(event => event.event === 'kernel-runtime-start')).toBe(true)
        expect(logEvents.some(event => event.event === 'kernel-runtime-modules-resolved')).toBe(true)
        expect(logEvents.some(event => event.event === 'kernel-runtime-host-bootstrap')).toBe(true)
        expect(logEvents.some(event => event.event === 'kernel-runtime-install')).toBe(true)

        const requestId = createRequestId()
        const result = await runtime.execute({
            commandName: 'kernel.base.runtime-shell.test.echo',
            payload: {ok: true},
            requestId,
        })

        expect(lifecyclePhases).toEqual([
            'host-bootstrap',
            'install',
            'initialize-handler',
            'execute-handler',
        ])
        expect(result.status).toBe('completed')

        const state = runtime.getState()
        const projection = selectRequestProjection(state, requestId)
        const errorCatalogEntry = selectErrorCatalogEntry(state, 'kernel.base.runtime-shell.test.error')
        const parameterCatalogEntry = selectParameterCatalogEntry(state, 'kernel.base.runtime-shell.test.parameter')
        const appCounterState = state[APP_COUNTER_SLICE as keyof typeof state] as {
            value: number
            updatedAt: number
        } | undefined

        expect(projection?.status).toBe('complete')
        expect(errorCatalogEntry?.template).toBe('runtime shell test error persisted')
        expect(parameterCatalogEntry?.rawValue).toBe(88)
        expect(appCounterState).toEqual({
            value: 1,
            updatedAt: 123,
        })

        runtime.getSubsystems().topology.updateRecoveryState({
            instanceMode: 'SLAVE',
            masterInfo: {
                deviceId: 'persisted-master',
                serverAddress: [{address: 'ws://127.0.0.1:7788'}],
                addedAt: 777 as any,
            },
        })

        await runtime.flushPersistence()

        const snapshot = runtime.exportRequestLifecycleSnapshot(requestId)
        expect(snapshot?.status).toBe('complete')

        const restoredRuntime = createKernelRuntime({
            localNodeId: createNodeId(),
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test.restore',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [],
        })

        await restoredRuntime.start()
        restoredRuntime.applyRequestLifecycleSnapshot(snapshot!)

        const restoredProjection = selectRequestProjection(
            restoredRuntime.getState(),
            requestId,
        )

        expect(restoredProjection?.status).toBe('complete')
        expect(restoredProjection?.mergedResults.payload).toBeDefined()

        const persistedRuntime = createKernelRuntime({
            localNodeId: runtimeNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test.persisted',
                        layer: 'kernel',
                    },
                }),
                stateStorage: persistedStorage.storage,
            }),
            modules: [createDemoModule([])],
        })

        await persistedRuntime.start()

        expect(selectErrorCatalogEntry(
            persistedRuntime.getState(),
            'kernel.base.runtime-shell.test.error',
        )?.template).toBe('runtime shell test error persisted')
        expect(selectParameterCatalogEntry(
            persistedRuntime.getState(),
            'kernel.base.runtime-shell.test.parameter',
        )?.rawValue).toBe(88)

        const persistedAppCounterState = persistedRuntime.getState()[APP_COUNTER_SLICE as keyof ReturnType<typeof persistedRuntime.getState>] as {
            value: number
            updatedAt: number
        } | undefined

        expect(persistedAppCounterState).toEqual({
            value: 1,
            updatedAt: 123,
        })
        expect(persistedRuntime.getSubsystems().topology.getRecoveryState().masterInfo?.deviceId).toBe('persisted-master')
    })

    it('converges owner projection after remote child command events round-trip', async () => {
        const remoteOwnerNodeId = createNodeId()
        const remotePeerNodeId = createNodeId()
        const remoteRequestId = createRequestId()
        const remoteSessionId = createSessionId()
        const ownerRuntime = createKernelRuntime({
            localNodeId: remoteOwnerNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test.remote-owner',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createDemoModule([])],
        })

        await ownerRuntime.start()

        const remoteRootResult = await ownerRuntime.execute({
            commandName: 'kernel.base.runtime-shell.test.echo',
            payload: {owner: true},
            requestId: remoteRequestId,
        })

        expect(remoteRootResult.status).toBe('completed')

        const remoteRootCommandId = ownerRuntime
            .exportRequestLifecycleSnapshot(remoteRequestId, remoteSessionId)
            ?.rootCommandId

        expect(remoteRootCommandId).toBeDefined()

        const remoteDispatchEnvelope = ownerRuntime.createRemoteDispatchEnvelope({
            requestId: remoteRequestId,
            sessionId: remoteSessionId,
            parentCommandId: remoteRootCommandId!,
            targetNodeId: remotePeerNodeId,
            commandName: 'kernel.base.runtime-shell.test.echo',
            payload: {peer: 'done'},
        })

        const peerRuntime = createKernelRuntime({
            localNodeId: remotePeerNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test.remote-peer',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [createDemoModule([])],
        })

        await peerRuntime.start()

        const streamedEventTypes: string[] = []
        const remoteHandleResult = await peerRuntime.handleRemoteDispatch(remoteDispatchEnvelope, {
            onEvent(event) {
                streamedEventTypes.push(event.eventType)
            },
        })
        expect(remoteHandleResult.events).toHaveLength(3)
        expect(streamedEventTypes).toEqual(['accepted', 'started', 'completed'])
        expect(remoteHandleResult.events.map(event => event.eventType)).toEqual(['accepted', 'started', 'completed'])

        remoteHandleResult.events.forEach(event => {
            ownerRuntime.applyRemoteCommandEvent(event)
        })

        const remoteFinalProjection = ownerRuntime.getRequestProjection(remoteRequestId)
        expect(remoteFinalProjection?.status).toBe('complete')
        expect(remoteFinalProjection?.resultsByCommand[remoteDispatchEnvelope.commandId]?.payload).toBeDefined()
        expect((remoteFinalProjection?.mergedResults.payload as {peer?: string} | undefined)?.peer).toBe('done')
    })

    it('applies state sync diff into app-wide state through module context', async () => {
        const runtimeNodeId = createNodeId()
        const lifecyclePhases: string[] = []
        let capturedContext: any
        const baseModule = createDemoModule(lifecyclePhases)

        const runtime = createKernelRuntime({
            localNodeId: runtimeNodeId,
            platformPorts: createPlatformPorts({
                environmentMode: 'DEV',
                logger: createLoggerPort({
                    environmentMode: 'DEV',
                    write() {},
                    scope: {
                        moduleName: 'kernel.base.runtime-shell.test.sync-diff',
                        layer: 'kernel',
                    },
                }),
            }),
            modules: [
                {
                    ...baseModule,
                    install(context) {
                        baseModule.install?.(context)
                        capturedContext = context
                    },
                },
            ],
        })

        await runtime.start()

        const envelope: StateSyncDiffEnvelope = {
            envelopeId: createEnvelopeId(),
            sessionId: createSessionId(),
            sourceNodeId: createNodeId(),
            targetNodeId: runtimeNodeId,
            direction: 'master-to-slave',
            diffBySlice: {
                [APP_COUNTER_SLICE]: [
                    {
                        key: 'counter',
                        value: {
                            value: {
                                value: 7,
                                updatedAt: 456,
                            },
                            updatedAt: 456 as any,
                        },
                    },
                ],
            },
            sentAt: 456 as any,
        }

        capturedContext!.applyStateSyncDiff(envelope)

        const runtimeState = runtime.getState()
        const state = runtimeState[APP_COUNTER_SLICE as keyof typeof runtimeState] as {
            value: number
            updatedAt: number
        }
        expect(state).toEqual({
            value: 7,
            updatedAt: 456,
        })
    })
})
