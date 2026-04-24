import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {uiRuntimeV2CommandDefinitions} from '../features/commands'
import {uiRuntimeV2StateSlices} from '../features/slices'
import {
    uiRuntimeV2ErrorDefinitionList,
    uiRuntimeV2ParameterDefinitionList,
} from '../supports'

export const uiRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    stateSlices: uiRuntimeV2StateSlices,
    commandDefinitions: Object.values(uiRuntimeV2CommandDefinitions),
    errorDefinitions: uiRuntimeV2ErrorDefinitionList,
    parameterDefinitions: uiRuntimeV2ParameterDefinitionList,
})
