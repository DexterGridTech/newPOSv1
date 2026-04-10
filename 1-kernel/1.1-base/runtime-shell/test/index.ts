import {
    createNodeId,
    createRequestId,
    createSessionId,
} from '@impos2/kernel-base-contracts'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {createPlatformPorts, createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createKernelRuntime,
    type packageVersion as _PackageVersionNeverUsed,
    packageVersion,
    selectErrorCatalogEntry,
    selectParameterCatalogEntry,
    selectRequestProjection,
} from '../src'
import type {KernelRuntimeModule} from '../src'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'

const lifecyclePhases: string[] = []
const logEvents: Array<{event?: string; message?: string}> = []

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
    syncIntent: 'isolated',
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

const demoModule: KernelRuntimeModule = {
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
}

const persistedStorage = createMemoryStorage()
const runtimeNodeId = createNodeId()
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

const main = async () => {
    await runtime.start()

    if (!logEvents.some(event => event.event === 'kernel-runtime-start')) {
        throw new Error('Runtime shell did not emit kernel runtime start log')
    }

    if (!logEvents.some(event => event.event === 'kernel-runtime-modules-resolved')) {
        throw new Error('Runtime shell did not emit module load log')
    }

    if (!logEvents.some(event => event.event === 'kernel-runtime-host-bootstrap')) {
        throw new Error('Runtime shell did not emit host bootstrap log')
    }

    if (!logEvents.some(event => event.event === 'kernel-runtime-install')) {
        throw new Error('Runtime shell did not emit install log')
    }

    const requestId = createRequestId()
    const result = await runtime.execute({
        commandName: 'kernel.base.runtime-shell.test.echo',
        payload: {ok: true},
        requestId,
    })

    if (lifecyclePhases.join(',') !== 'host-bootstrap,install,initialize-handler,execute-handler') {
        throw new Error(`Unexpected lifecycle phase order: ${lifecyclePhases.join(',')}`)
    }

    if (result.status !== 'completed') {
        throw new Error('Runtime shell execute did not complete')
    }

    const state = runtime.getState()
    const projection = selectRequestProjection(state, requestId)
    const errorCatalogEntry = selectErrorCatalogEntry(state, 'kernel.base.runtime-shell.test.error')
    const parameterCatalogEntry = selectParameterCatalogEntry(state, 'kernel.base.runtime-shell.test.parameter')

    if (!projection || projection.status !== 'complete') {
        throw new Error('Runtime shell request projection selector did not expose completed request')
    }

    if (!errorCatalogEntry || errorCatalogEntry.template !== 'runtime shell test error persisted') {
        throw new Error('Runtime shell error catalog is not readable')
    }

    if (!parameterCatalogEntry || parameterCatalogEntry.rawValue !== 88) {
        throw new Error('Runtime shell parameter catalog is not readable')
    }

    const appCounterState = state[APP_COUNTER_SLICE as keyof typeof state] as {
        value: number
        updatedAt: number
    } | undefined

    if (!appCounterState || appCounterState.value !== 1 || appCounterState.updatedAt !== 123) {
        throw new Error('Runtime shell app-wide state slices are not readable from unified root state')
    }

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
    if (!snapshot || snapshot.status !== 'complete') {
        throw new Error('Runtime shell did not export request lifecycle snapshot')
    }

    const restoredRuntime = createKernelRuntime({
        localNodeId: createNodeId(),
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write: event => {
                logEvents.push({event: event.event, message: event.message})
            },
            scope: {
                moduleName: 'kernel.base.runtime-shell.test.restore',
                layer: 'kernel',
                },
            }),
        }),
        modules: [],
    })

    await restoredRuntime.start()
    restoredRuntime.applyRequestLifecycleSnapshot(snapshot)

    const restoredProjection = selectRequestProjection(
        restoredRuntime.getState(),
        requestId,
    )

    if (!restoredProjection || restoredProjection.status !== 'complete') {
        throw new Error('Runtime shell did not restore request projection from lifecycle snapshot')
    }

    if (restoredProjection.mergedResults.payload == null) {
        throw new Error('Runtime shell restored projection lost merged results')
    }

    const persistedRuntime = createKernelRuntime({
        localNodeId: runtimeNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
            logger: createLoggerPort({
                environmentMode: 'DEV',
                write: event => {
                    logEvents.push({event: event.event, message: event.message})
                },
                scope: {
                    moduleName: 'kernel.base.runtime-shell.test.persisted',
                    layer: 'kernel',
                },
            }),
            stateStorage: persistedStorage.storage,
        }),
        modules: [demoModule],
    })

    await persistedRuntime.start()

    const persistedError = selectErrorCatalogEntry(
        persistedRuntime.getState(),
        'kernel.base.runtime-shell.test.error',
    )
    const persistedParameter = selectParameterCatalogEntry(
        persistedRuntime.getState(),
        'kernel.base.runtime-shell.test.parameter',
    )

    if (!persistedError || persistedError.template !== 'runtime shell test error persisted') {
        throw new Error('Runtime shell did not restore persisted error catalog')
    }

    if (!persistedParameter || persistedParameter.rawValue !== 88) {
        throw new Error('Runtime shell did not restore persisted parameter catalog')
    }

    const persistedAppCounterState = persistedRuntime.getState()[APP_COUNTER_SLICE as keyof ReturnType<typeof persistedRuntime.getState>] as {
        value: number
        updatedAt: number
    } | undefined

    if (!persistedAppCounterState || persistedAppCounterState.value !== 1 || persistedAppCounterState.updatedAt !== 123) {
        throw new Error('Runtime shell did not restore persisted app-wide state')
    }

    if (persistedRuntime.getSubsystems().topology.getRecoveryState().masterInfo?.deviceId !== 'persisted-master') {
        throw new Error('Runtime shell did not restore persisted topology recovery state')
    }

    const remoteOwnerNodeId = createNodeId()
    const remotePeerNodeId = createNodeId()
    const remoteRequestId = createRequestId()
    const remoteSessionId = createSessionId()

    const remoteOwnerRuntime = createKernelRuntime({
        localNodeId: remoteOwnerNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write: event => {
                logEvents.push({event: event.event, message: event.message})
            },
            scope: {
                moduleName: 'kernel.base.runtime-shell.test.remote-owner',
                layer: 'kernel',
                },
            }),
        }),
        modules: [demoModule],
    })
    await remoteOwnerRuntime.start()

    const remoteRootResult = await remoteOwnerRuntime.execute({
        commandName: 'kernel.base.runtime-shell.test.echo',
        payload: {owner: true},
        requestId: remoteRequestId,
    })

    if (remoteRootResult.status !== 'completed') {
        throw new Error('Remote owner root command did not complete')
    }

    const remoteOwnerProjection = remoteOwnerRuntime.getRequestProjection(remoteRequestId)
    if (!remoteOwnerProjection) {
        throw new Error('Remote owner projection missing after root execute')
    }

    const remoteRootCommandId = remoteOwnerRuntime
        .exportRequestLifecycleSnapshot(remoteRequestId, remoteSessionId)
        ?.rootCommandId

    if (!remoteRootCommandId) {
        throw new Error('Remote owner snapshot missing root command id')
    }

    const remoteDispatchEnvelope = remoteOwnerRuntime.createRemoteDispatchEnvelope({
        requestId: remoteRequestId,
        sessionId: remoteSessionId,
        parentCommandId: remoteRootCommandId,
        targetNodeId: remotePeerNodeId,
        commandName: 'kernel.base.runtime-shell.test.echo',
        payload: {peer: 'done'},
    })

    const remotePeerRuntime = createKernelRuntime({
        localNodeId: remotePeerNodeId,
        platformPorts: createPlatformPorts({
            environmentMode: 'DEV',
        logger: createLoggerPort({
            environmentMode: 'DEV',
            write: event => {
                logEvents.push({event: event.event, message: event.message})
            },
            scope: {
                moduleName: 'kernel.base.runtime-shell.test.remote-peer',
                layer: 'kernel',
                },
            }),
        }),
        modules: [demoModule],
    })
    await remotePeerRuntime.start()

    const remoteHandleResult = await remotePeerRuntime.handleRemoteDispatch(remoteDispatchEnvelope)
    if (remoteHandleResult.events.length !== 3) {
        throw new Error(`Unexpected remote event count: ${remoteHandleResult.events.length}`)
    }

    remoteHandleResult.events.forEach(event => {
        remoteOwnerRuntime.applyRemoteCommandEvent(event)
    })

    const remoteFinalProjection = remoteOwnerRuntime.getRequestProjection(remoteRequestId)
    if (!remoteFinalProjection || remoteFinalProjection.status !== 'complete') {
        throw new Error('Remote command round-trip did not converge owner projection')
    }

    if (remoteFinalProjection.resultsByCommand[remoteDispatchEnvelope.commandId]?.payload == null) {
        throw new Error('Remote command result was not recorded under child command id')
    }

    if ((remoteFinalProjection.mergedResults.payload as {peer?: string} | undefined)?.peer !== 'done') {
        throw new Error('Remote command result was not merged back to owner projection')
    }

    console.log('[runtime-shell-test-scenario]', {
        packageName: '@impos2/kernel-base-runtime-shell',
        packageVersion,
        runtimeId: runtime.runtimeId,
        lifecyclePhases,
        result,
        projection,
        snapshot,
        restoredProjection,
        remoteDispatchEnvelope,
        remoteFinalProjection,
        errorCatalogEntry,
        parameterCatalogEntry,
    })
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
