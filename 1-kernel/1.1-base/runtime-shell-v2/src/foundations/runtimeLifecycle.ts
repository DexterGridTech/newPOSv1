import type {EnhancedStore, UnknownAction} from '@reduxjs/toolkit'
import {runtimeShellV2CommandDefinitions} from '../features/commands'
import type {
    KernelRuntimeModuleV2,
    PeerDispatchGateway,
    RuntimeModuleContextV2,
} from '../types'
import {bootstrapRuntimeCatalogs} from './runtimeCatalogBootstrap'
import {createCommand} from './command'

interface CreateRuntimeLifecycleInput {
    runtimeId: import('@impos2/kernel-base-contracts').RuntimeInstanceId
    localNodeId: import('@impos2/kernel-base-contracts').NodeId
    modules: readonly KernelRuntimeModuleV2[]
    store: EnhancedStore
    platformPorts: RuntimeModuleContextV2['platformPorts']
    displayContext: RuntimeModuleContextV2['displayContext']
    stateRuntime: {
        hydratePersistence(): Promise<void>
        resetState(): Promise<void>
    }
    dispatchAction: (action: UnknownAction) => UnknownAction
    subscribeState: (listener: () => void) => () => void
    dispatchCommand: RuntimeModuleContextV2['dispatchCommand']
    queryRequest: RuntimeModuleContextV2['queryRequest']
    resolveParameter: RuntimeModuleContextV2['resolveParameter']
    registerMirroredCommand: RuntimeModuleContextV2['registerMirroredCommand']
    applyRemoteCommandEvent: RuntimeModuleContextV2['applyRemoteCommandEvent']
    applyRequestLifecycleSnapshot: RuntimeModuleContextV2['applyRequestLifecycleSnapshot']
    getSyncSlices: RuntimeModuleContextV2['getSyncSlices']
    applyStateSyncDiff: RuntimeModuleContextV2['applyStateSyncDiff']
    getActorCount: () => number
    setPeerDispatchGateway: (gateway: PeerDispatchGateway | undefined) => void
}

const createRuntimeModuleInstallContext = (input: CreateRuntimeLifecycleInput) => {
    return (module: KernelRuntimeModuleV2): RuntimeModuleContextV2 => ({
        moduleName: module.moduleName,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        displayContext: input.displayContext,
        getState: () => input.store.getState() as any,
        getStore: () => input.store,
        dispatchAction: input.dispatchAction,
        subscribeState: input.subscribeState,
        dispatchCommand: input.dispatchCommand,
        installPeerDispatchGateway: gateway => {
            input.setPeerDispatchGateway(gateway)
        },
        queryRequest: input.queryRequest,
        resolveParameter: input.resolveParameter,
        registerMirroredCommand: input.registerMirroredCommand,
        applyRemoteCommandEvent: input.applyRemoteCommandEvent,
        applyRequestLifecycleSnapshot: input.applyRequestLifecycleSnapshot,
        getSyncSlices: input.getSyncSlices,
        applyStateSyncDiff: input.applyStateSyncDiff,
    })
}

export const createRuntimeLifecycle = (input: CreateRuntimeLifecycleInput) => {
    const installContextFactory = createRuntimeModuleInstallContext(input)

    const runInitialize = async () => {
        bootstrapRuntimeCatalogs(input.modules, input.dispatchAction)
        const initializeResult = await input.dispatchCommand(
            createCommand(runtimeShellV2CommandDefinitions.initialize, {}),
        )

        if (initializeResult.status !== 'COMPLETED') {
            input.platformPorts.logger.error({
                category: 'runtime.load',
                event: 'runtime-shell-v2-initialize-failed',
                message: 'runtime-shell-v2 initialize failed',
                data: {
                    runtimeId: input.runtimeId,
                    localNodeId: input.localNodeId,
                    requestId: initializeResult.requestId,
                    commandId: initializeResult.commandId,
                    status: initializeResult.status,
                    actorResults: initializeResult.actorResults,
                },
            })
            throw new Error(`runtime-shell-v2 initialize failed: ${initializeResult.status}`)
        }
    }

    /**
     * 启动顺序必须稳定：
     * 先恢复 state-runtime，再注册 catalog，再 install 模块，最后广播 initialize。
     * 这继承旧 Core “store 可用后统一 initialize”的思想，保证模块初始化时能读到已恢复的配置和业务状态。
     */
    const start = async () => {
        input.platformPorts.logger.info({
            category: 'runtime.load',
            event: 'runtime-shell-v2-start',
            message: 'start runtime-shell-v2',
            data: {
                runtimeId: input.runtimeId,
                localNodeId: input.localNodeId,
                modules: input.modules.map(item => item.moduleName),
                actorCount: input.getActorCount(),
            },
        })

        await input.stateRuntime.hydratePersistence()

        for (const module of input.modules) {
            await module.install?.(installContextFactory(module))
        }

        await runInitialize()
    }

    const resetApplicationState = async (reason?: string) => {
        input.platformPorts.logger.warn({
            category: 'runtime.reset',
            event: 'runtime-shell-v2-reset-application-state',
            message: 'reset runtime application state',
            data: {
                runtimeId: input.runtimeId,
                localNodeId: input.localNodeId,
                reason,
            },
        })
        await input.stateRuntime.resetState()
        await runInitialize()
    }

    return {
        start,
        resetApplicationState,
    }
}
