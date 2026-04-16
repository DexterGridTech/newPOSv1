import {createNodeId, createRuntimeInstanceId} from '@impos2/kernel-base-contracts'
import type {
    KernelRuntimeAppConfigV2,
    KernelRuntimeAppDescriptorV2,
    KernelRuntimeAppV2,
    KernelRuntimeV2,
} from '../types'
import {createKernelRuntimeV2} from '../foundations/createKernelRuntimeV2'
import {createDefaultRuntimePlatformPortsV2} from '../foundations/platformPorts'
import {describeKernelRuntimeModuleV2} from './moduleDescriptor'
import {resolveKernelRuntimeModuleOrderV2} from './resolveModuleOrder'
import {createRuntimeAppLoggerV2} from './runtimeAppLogger'

const createKernelRuntimeAppDescriptorV2 = (input: {
    runtimeName: string
    runtime: KernelRuntimeV2
    moduleDescriptors: readonly KernelRuntimeAppDescriptorV2['moduleDescriptors'][number][]
}): KernelRuntimeAppDescriptorV2 => ({
    runtimeName: input.runtimeName,
    runtimeId: input.runtime.runtimeId,
    localNodeId: input.runtime.localNodeId,
    moduleDescriptors: input.moduleDescriptors,
})

const runRuntimeModulePreSetupV2 = async (input: {
    descriptor: KernelRuntimeAppDescriptorV2
    localNodeId: KernelRuntimeV2['localNodeId']
    platformPorts: ReturnType<typeof createDefaultRuntimePlatformPortsV2>
    displayContext: import('../types').RuntimeDisplayContextV2
    modules: readonly NonNullable<KernelRuntimeAppConfigV2['modules']>[number][]
    moduleDescriptors: readonly KernelRuntimeAppDescriptorV2['moduleDescriptors'][number][]
    logger: ReturnType<typeof createRuntimeAppLoggerV2>
}) => {
    input.logger.preSetupStarted(input.descriptor)
    for (let index = 0; index < input.modules.length; index += 1) {
        const module = input.modules[index]
        const moduleDescriptor = input.moduleDescriptors[index]
        await module.preSetup?.({
            moduleName: module.moduleName,
            localNodeId: input.localNodeId,
            platformPorts: input.platformPorts,
            displayContext: input.displayContext,
            descriptors: input.moduleDescriptors,
        })
        input.logger.preSetupCompleted(moduleDescriptor)
    }
}

export const createKernelRuntimeApp = (
    config: KernelRuntimeAppConfigV2 = {},
): KernelRuntimeAppV2 => {
    const runtimeName = config.runtimeName ?? 'kernel-runtime-app-v2'
    const runtimeId = config.runtimeId ?? createRuntimeInstanceId()
    const localNodeId = config.localNodeId ?? createNodeId()
    const modules = resolveKernelRuntimeModuleOrderV2([...(config.modules ?? [])])
    const platformPorts = createDefaultRuntimePlatformPortsV2(config.platformPorts)
    const displayContext = config.displayContext ?? {}
    const runtime = createKernelRuntimeV2({
        runtimeId,
        localNodeId,
        platformPorts,
        modules,
        peerDispatchGateway: config.peerDispatchGateway,
        displayContext,
    })
    const moduleDescriptors = modules.map(describeKernelRuntimeModuleV2)
    const descriptor: KernelRuntimeAppDescriptorV2 = createKernelRuntimeAppDescriptorV2({
        runtimeName,
        moduleDescriptors,
        runtime,
    })
    const logger = createRuntimeAppLoggerV2(platformPorts.logger)
    let started = false
    let startPromise: Promise<KernelRuntimeV2> | null = null

    const start = async (): Promise<KernelRuntimeV2> => {
        if (started) {
            return runtime
        }
        if (startPromise) {
            return await startPromise
        }

        startPromise = (async () => {
            logger.appCreated(descriptor)
            await runRuntimeModulePreSetupV2({
                descriptor,
                localNodeId,
                platformPorts,
                displayContext,
                modules,
                moduleDescriptors,
                logger,
            })
            logger.startRuntime(descriptor)
            await runtime.start()
            logger.started(descriptor)
            started = true
            return runtime
        })()

        return await startPromise
    }

    const app: KernelRuntimeAppV2 = {
        runtimeName,
        runtime,
        descriptor,
        start,
        async flushPersistence() {
            if (config.autoStart) {
                await start()
            }
            await runtime.flushPersistence()
        },
    }

    if (config.autoStart) {
        void start()
    }

    return app
}
