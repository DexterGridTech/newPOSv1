import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {topologyRuntimeV2CommandDefinitions} from '../features/commands'
import {topologyRuntimeV2StateSlices} from '../features/slices'
import {
    topologyRuntimeV2ErrorDefinitionList,
    topologyRuntimeV2ParameterDefinitionList,
} from '../supports'

export const topologyRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    stateSlices: topologyRuntimeV2StateSlices,
    commandDefinitions: Object.values(topologyRuntimeV2CommandDefinitions),
    errorDefinitions: topologyRuntimeV2ErrorDefinitionList,
    parameterDefinitions: topologyRuntimeV2ParameterDefinitionList,
})
