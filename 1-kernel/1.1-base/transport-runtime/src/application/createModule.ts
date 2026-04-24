import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createCommand,
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import type {TransportServerConfig} from '../types'
import {transportRuntimeModuleManifest} from './moduleManifest'
import {createTransportRuntimeActorDefinitions} from '../features/actors'
import {transportRuntimeCommandDefinitions} from '../features/commands'
import {selectTransportSelectedServerSpace} from '../selectors'
import {selectTransportAvailableServerSpaces} from '../selectors'

export interface CreateTransportRuntimeModuleInput {
    serverConfig: TransportServerConfig
}

export const transportRuntimePreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createTransportRuntimeModule = (
    input: CreateTransportRuntimeModuleInput,
): KernelRuntimeModuleV2 => defineKernelRuntimeModuleV2({
    ...transportRuntimeModuleManifest,
    actorDefinitions: createTransportRuntimeActorDefinitions(input.serverConfig),
    preSetup: transportRuntimePreSetup,
    async install(context: RuntimeModuleContextV2) {
        await context.dispatchCommand(createCommand(
            transportRuntimeCommandDefinitions.initializeServerSpace,
            {
                config: input.serverConfig,
                selectedSpace: selectTransportSelectedServerSpace(context.getState()),
            },
        ))
        createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
            stateSlices: transportRuntimeModuleManifest.stateSliceNames,
            commandNames: transportRuntimeModuleManifest.commandNames,
        })
    },
})

export const transportRuntimeModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(() => createTransportRuntimeModule({
        serverConfig: {
            selectedSpace: 'default',
            spaces: [{name: 'default', servers: []}],
        },
    }))
