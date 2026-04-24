import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {tcpControlV2CommandDefinitions} from '../features/commands'
import {tcpControlV2StateSlices} from '../features/slices'
import {
    tcpControlV2ErrorDefinitionList,
    tcpControlV2ParameterDefinitionList,
} from '../supports'

export const tcpControlRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    stateSlices: tcpControlV2StateSlices,
    commandDefinitions: Object.values(tcpControlV2CommandDefinitions),
    errorDefinitions: tcpControlV2ErrorDefinitionList,
    parameterDefinitions: tcpControlV2ParameterDefinitionList,
})
