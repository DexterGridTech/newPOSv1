import {
    createNodeId,
    createRuntimeInstanceId,
} from '@impos2/kernel-base-contracts'
import {createStateRuntime} from '@impos2/kernel-base-state-runtime'
import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import {moduleName} from '../moduleName'
import type {
    CreateKernelRuntimeV2Input,
    KernelRuntimeV2,
    PeerDispatchGateway,
} from '../types'
import {createRequestLedger} from './requestLedger'
import {createRuntimeShellInternalModuleV2} from './internalModule'
import {createDefaultRuntimePlatformPortsV2} from './platformPorts'
import {createRuntimeActorRegistry} from './runtimeActorRegistry'
import {createRuntimeCommandDispatcher} from './runtimeCommandDispatcher'
import {createRuntimeLifecycle} from './runtimeLifecycle'
import {createRuntimeParameterResolver} from './runtimeParameterResolver'
import {createRuntimeStateSync} from './runtimeStateSync'

/**
 * 设计意图：
 * 这里是 runtime-shell-v2 的总装配入口，但内部职责已经拆成多个基础部件。
 * 这样既保留“一个 createRuntime 就能把内核运行起来”的清晰入口，又避免重新长出第二个大而全的 ApplicationManager。
 */
export const createKernelRuntimeV2 = (
    input: CreateKernelRuntimeV2Input = {},
): KernelRuntimeV2 => {
    const runtimeId = input.runtimeId ?? createRuntimeInstanceId()
    const localNodeId = input.localNodeId ?? createNodeId()
    const platformPorts = createDefaultRuntimePlatformPortsV2(input.platformPorts)
    const modules = [
        createRuntimeShellInternalModuleV2(),
        ...(input.modules ?? []),
    ]
    const stateRuntime = createStateRuntime({
        runtimeName: moduleName,
        logger: platformPorts.logger.scope({moduleName, subsystem: 'state-runtime'}),
        slices: modules.flatMap(module => [...(module.stateSlices ?? [])]),
        stateStorage: platformPorts.stateStorage,
        secureStateStorage: platformPorts.secureStateStorage,
        persistenceKey: `kernel-runtime-v2:${localNodeId}:app-state`,
        allowPersistence: true,
    })
    const ledger = createRequestLedger()
    const actorRegistry = createRuntimeActorRegistry(modules)
    const stateSync = createRuntimeStateSync(stateRuntime)
    const store = stateRuntime.getStore() as EnhancedStore
    const dispatchAction = (action: UnknownAction) => store.dispatch(action)
    const subscribeState = (listener: () => void) => store.subscribe(listener)
    const queryRequest = (requestId: string) => ledger.query(requestId as any)
    const resolveParameter = createRuntimeParameterResolver(store)
    let startPromise: Promise<void> | null = null
    let peerDispatchGateway: PeerDispatchGateway | undefined = input.peerDispatchGateway

    const registerMirroredCommand: KernelRuntimeV2['registerMirroredCommand'] = mirror => {
        ledger.registerMirroredCommand(mirror)
    }
    const applyRemoteCommandEvent: KernelRuntimeV2['applyRemoteCommandEvent'] = envelope => {
        ledger.applyRemoteCommandEvent(envelope)
    }
    const applyRequestLifecycleSnapshot: KernelRuntimeV2['applyRequestLifecycleSnapshot'] = snapshot => {
        ledger.applyRequestLifecycleSnapshot(snapshot)
    }

    const dispatcher = createRuntimeCommandDispatcher({
        runtimeId,
        localNodeId,
        store,
        dispatchAction,
        subscribeState,
        ledger,
        handlersByCommand: actorRegistry.handlersByCommand,
        resolveParameter,
        queryRequest,
        getPeerDispatchGateway: () => peerDispatchGateway,
    })

    const lifecycle = createRuntimeLifecycle({
        runtimeId,
        localNodeId,
        modules,
        store,
        platformPorts,
        stateRuntime,
        dispatchAction,
        subscribeState,
        dispatchCommand: dispatcher.dispatchCommand,
        queryRequest,
        resolveParameter,
        registerMirroredCommand,
        applyRemoteCommandEvent,
        applyRequestLifecycleSnapshot,
        getSyncSlices: stateSync.getSyncSlices,
        applyStateSyncDiff: stateSync.applyStateSyncDiff,
        getActorCount: actorRegistry.getActorCount,
        setPeerDispatchGateway(gateway) {
            peerDispatchGateway = gateway
        },
    })

    return {
        runtimeId,
        localNodeId,
        async start() {
            if (startPromise) {
                return await startPromise
            }
            startPromise = lifecycle.start()
            return await startPromise
        },
        dispatchCommand(command, options) {
            return dispatcher.dispatchCommand(command, options)
        },
        queryRequest(requestId) {
            return ledger.query(requestId)
        },
        subscribeRequest(requestId, listener) {
            return ledger.subscribeRequest(requestId, listener)
        },
        subscribeRequests(listener) {
            return ledger.subscribeRequests(listener)
        },
        subscribeState,
        getState() {
            return store.getState() as any
        },
        getStore() {
            return store
        },
        resolveParameter,
        registerMirroredCommand,
        applyRemoteCommandEvent,
        applyRequestLifecycleSnapshot,
        getSyncSlices: stateSync.getSyncSlices,
        applyStateSyncDiff: stateSync.applyStateSyncDiff,
        installPeerDispatchGateway(gateway) {
            peerDispatchGateway = gateway
        },
        async flushPersistence() {
            await stateRuntime.flushPersistence()
        },
    }
}
