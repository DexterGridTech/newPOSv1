import type {
    ActorDefinition,
    AnyActorCommandHandlerDefinition,
    CommandDefinition,
    DefineCommandInput,
    KernelRuntimeModuleDescriptorV2,
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '../types'
import {defineCommand} from '../foundations/command'
import {describeKernelRuntimeModuleV2} from '../application/moduleDescriptor'

export interface DefineKernelRuntimeModuleManifestV2Input {
    moduleName: string
    packageVersion: string
    protocolVersion?: string
    dependencies?: KernelRuntimeModuleV2['dependencies']
    stateSlices?: KernelRuntimeModuleV2['stateSlices']
    commandDefinitions?: KernelRuntimeModuleV2['commandDefinitions']
    errorDefinitions?: KernelRuntimeModuleV2['errorDefinitions']
    parameterDefinitions?: KernelRuntimeModuleV2['parameterDefinitions']
}

export interface KernelRuntimeModuleManifestV2 {
    moduleName: string
    packageVersion: string
    protocolVersion?: string
    dependencies: NonNullable<KernelRuntimeModuleV2['dependencies']>
    stateSlices: NonNullable<KernelRuntimeModuleV2['stateSlices']>
    commandDefinitions: NonNullable<KernelRuntimeModuleV2['commandDefinitions']>
    errorDefinitions: NonNullable<KernelRuntimeModuleV2['errorDefinitions']>
    parameterDefinitions: NonNullable<KernelRuntimeModuleV2['parameterDefinitions']>
    stateSliceNames: readonly string[]
    commandNames: readonly string[]
    errorKeys: readonly string[]
    parameterKeys: readonly string[]
}

export const createModuleCommandFactory = (moduleName: string) => {
    return <TPayload = unknown>(
        commandName: string,
        input: Omit<DefineCommandInput, 'moduleName' | 'commandName'> = {},
    ): CommandDefinition<TPayload> => defineCommand<TPayload>({
        moduleName,
        commandName,
        ...input,
    })
}

export const defineModuleActor = (
    moduleName: string,
    actorName: string,
    handlers: readonly AnyActorCommandHandlerDefinition[],
): ActorDefinition => ({
    moduleName,
    actorName,
    handlers,
})

export const createModuleActorFactory = (moduleName: string) => {
    return (
        actorName: string,
        handlers: readonly AnyActorCommandHandlerDefinition[],
    ): ActorDefinition => defineModuleActor(moduleName, actorName, handlers)
}

export const defineKernelRuntimeModuleManifestV2 = (
    input: DefineKernelRuntimeModuleManifestV2Input,
): KernelRuntimeModuleManifestV2 => {
    const dependencies = [...(input.dependencies ?? [])]
    const stateSlices = [...(input.stateSlices ?? [])]
    const commandDefinitions = [...(input.commandDefinitions ?? [])]
    const errorDefinitions = [...(input.errorDefinitions ?? [])]
    const parameterDefinitions = [...(input.parameterDefinitions ?? [])]

    return {
        moduleName: input.moduleName,
        packageVersion: input.packageVersion,
        protocolVersion: input.protocolVersion,
        dependencies,
        stateSlices,
        commandDefinitions,
        errorDefinitions,
        parameterDefinitions,
        stateSliceNames: stateSlices.map(slice => slice.name),
        commandNames: commandDefinitions.map(definition => definition.commandName),
        errorKeys: errorDefinitions.map(definition => definition.key),
        parameterKeys: parameterDefinitions.map(definition => definition.key),
    }
}

export interface CreateRuntimeModuleLifecycleLoggerInput {
    moduleName: string
    context: RuntimeModulePreSetupContextV2 | RuntimeModuleContextV2
}

const buildLifecycleEvent = (
    moduleName: string,
    phase: 'pre-setup' | 'install',
) => `${moduleName}-${phase}`.replace(/\./g, '-')

export const createRuntimeModuleLifecycleLogger = (
    input: CreateRuntimeModuleLifecycleLoggerInput,
) => {
    const logger = input.context.platformPorts.logger

    return {
        logPreSetup() {
            logger.info({
                category: 'runtime.load',
                event: buildLifecycleEvent(input.moduleName, 'pre-setup'),
                message: `pre-setup ${input.moduleName}`,
                data: {
                    moduleName: input.moduleName,
                    runtimeNodeId: input.context.localNodeId,
                    knownModules: 'descriptors' in input.context
                        ? input.context.descriptors.map(item => item.moduleName)
                        : undefined,
                },
            })
        },
        logInstall(data: Record<string, unknown> = {}) {
            logger.info({
                category: 'runtime.load',
                event: buildLifecycleEvent(input.moduleName, 'install'),
                message: `install ${input.moduleName}`,
                data: {
                    moduleName: input.moduleName,
                    ...data,
                },
            })
        },
    }
}

export const defineKernelRuntimeModuleV2 = <
    TModule extends KernelRuntimeModuleV2,
>(
    module: TModule,
): TModule => module

export const deriveKernelRuntimeModuleDescriptorV2 = (
    createModule: () => KernelRuntimeModuleV2,
): KernelRuntimeModuleDescriptorV2 => describeKernelRuntimeModuleV2(createModule())
