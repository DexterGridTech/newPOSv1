import type {
    KernelRuntimeModuleDescriptorV2,
    KernelRuntimeModuleV2,
} from '../types'

export const describeKernelRuntimeModuleV2 = (
    module: KernelRuntimeModuleV2,
): KernelRuntimeModuleDescriptorV2 => ({
    moduleName: module.moduleName,
    packageVersion: module.packageVersion,
    protocolVersion: module.protocolVersion,
    dependencies: [...(module.dependencies ?? [])],
    stateSliceNames: (module.stateSlices ?? []).map(slice => slice.name),
    commandNames: (module.commandDefinitions ?? []).map(definition => definition.commandName),
    actorKeys: (module.actorDefinitions ?? []).map(actor =>
        actor.actorKey ?? `${actor.moduleName}.${actor.actorName}`,
    ),
    errorKeys: (module.errorDefinitions ?? []).map(definition => definition.key),
    parameterKeys: (module.parameterDefinitions ?? []).map(definition => definition.key),
    hasInstall: typeof module.install === 'function',
    hasPreSetup: typeof module.preSetup === 'function',
})

