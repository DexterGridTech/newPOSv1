import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {topologyRuntimeV3StateSlices} from '../features/slices'
import {
    topologyRuntimeV3ErrorDefinitionList,
    topologyRuntimeV3ParameterDefinitionList,
} from '../supports'
import {topologyRuntimeV3CommandDefinitions} from '../features/commands'

export const topologyRuntimeV3ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        stateSlices: topologyRuntimeV3StateSlices,
        commandDefinitions: Object.values(topologyRuntimeV3CommandDefinitions),
        errorDefinitions: topologyRuntimeV3ErrorDefinitionList,
        parameterDefinitions: topologyRuntimeV3ParameterDefinitionList,
    })
