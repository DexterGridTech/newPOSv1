import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {
    KernelRuntimeAppDescriptorV2,
    KernelRuntimeModuleDescriptorV2,
} from '../types'
import {moduleName} from '../moduleName'

const toModuleSummary = (descriptor: KernelRuntimeModuleDescriptorV2) => ({
    moduleName: descriptor.moduleName,
    packageVersion: descriptor.packageVersion,
    dependencies: descriptor.dependencies.map(item => item.moduleName),
    stateSliceNames: descriptor.stateSliceNames,
    commandNames: descriptor.commandNames,
    actorKeys: descriptor.actorKeys,
    errorKeys: descriptor.errorKeys,
    parameterKeys: descriptor.parameterKeys,
    hasInstall: descriptor.hasInstall,
    hasPreSetup: descriptor.hasPreSetup,
})

export const createRuntimeAppLoggerV2 = (logger: LoggerPort) => {
    const scopedLogger = logger.scope({
        moduleName,
        subsystem: 'application',
        component: 'KernelRuntimeAppV2',
    })

    return {
        appCreated(descriptor: KernelRuntimeAppDescriptorV2) {
            scopedLogger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-app-v2-created',
                message: 'created kernel runtime app v2',
                data: {
                    runtimeName: descriptor.runtimeName,
                    runtimeId: descriptor.runtimeId,
                    localNodeId: descriptor.localNodeId,
                    moduleNames: descriptor.moduleDescriptors.map(item => item.moduleName),
                },
            })
        },
        preSetupStarted(descriptor: KernelRuntimeAppDescriptorV2) {
            scopedLogger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-app-v2-pre-setup-started',
                message: 'start kernel runtime app v2 pre-setup',
                data: {
                    runtimeName: descriptor.runtimeName,
                    moduleNames: descriptor.moduleDescriptors.map(item => item.moduleName),
                },
            })
        },
        preSetupCompleted(moduleDescriptor: KernelRuntimeModuleDescriptorV2) {
            scopedLogger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-app-v2-module-pre-setup-completed',
                message: 'completed module pre-setup',
                data: toModuleSummary(moduleDescriptor),
            })
        },
        startRuntime(descriptor: KernelRuntimeAppDescriptorV2) {
            scopedLogger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-app-v2-start-runtime',
                message: 'start kernel runtime app v2 runtime',
                data: {
                    runtimeName: descriptor.runtimeName,
                    runtimeId: descriptor.runtimeId,
                    localNodeId: descriptor.localNodeId,
                    moduleCount: descriptor.moduleDescriptors.length,
                },
            })
        },
        started(descriptor: KernelRuntimeAppDescriptorV2) {
            scopedLogger.info({
                category: 'runtime.load',
                event: 'kernel-runtime-app-v2-started',
                message: 'kernel runtime app v2 started',
                data: {
                    runtimeName: descriptor.runtimeName,
                    moduleDescriptors: descriptor.moduleDescriptors.map(toModuleSummary),
                },
            })
        },
    }
}

