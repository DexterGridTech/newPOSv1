import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {createTdpSyncActorDefinitionsV2} from '../features/actors'
import {createTopicChangePublisherFingerprintV2} from '../foundations/topicChangePublisher'
import {
    createDefaultTdpSyncHttpRuntimeV2,
    installTdpSessionConnectionRuntimeV2,
} from '../foundations/sessionConnectionRuntime'
import {createTdpSyncHttpServiceV2} from '../foundations/httpService'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../types'
import {tdpSyncRuntimeV2ModuleManifest} from './moduleManifest'

export const tdpSyncRuntimeV2PreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTdpSyncRuntimeModuleV2 = (
    input: CreateTdpSyncRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const fingerprintRef = createTopicChangePublisherFingerprintV2()
    const connectionRuntimeRef = {}

    return defineKernelRuntimeModuleV2({
        ...tdpSyncRuntimeV2ModuleManifest,
        actorDefinitions: createTdpSyncActorDefinitionsV2(
            fingerprintRef,
            connectionRuntimeRef,
            input,
        ),
        preSetup: tdpSyncRuntimeV2PreSetup,
        install(context: RuntimeModuleContextV2) {
            createTdpSyncHttpServiceV2(
                input.assembly?.createHttpRuntime(context) ?? createDefaultTdpSyncHttpRuntimeV2(context),
            )
            installTdpSessionConnectionRuntimeV2({
                context,
                moduleInput: input,
                connectionRuntimeRef,
            })
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: tdpSyncRuntimeV2ModuleManifest.stateSliceNames,
                commandNames: tdpSyncRuntimeV2ModuleManifest.commandNames,
                hasAssembly: Boolean(input.assembly),
            })
        },
    })
}

export const tdpSyncRuntimeModuleV2Descriptor =
    deriveKernelRuntimeModuleDescriptorV2(createTdpSyncRuntimeModuleV2)
