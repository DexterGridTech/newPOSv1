import {moduleName as tcpControlRuntimeV2ModuleName} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {tdpSyncV2StateSlices} from '../features/slices'
import {
    tdpSyncV2ErrorDefinitionList,
    tdpSyncV2ParameterDefinitionList,
} from '../supports'

export const tdpSyncRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    dependencies: [
        {
            moduleName: tcpControlRuntimeV2ModuleName,
        },
    ],
    stateSlices: tdpSyncV2StateSlices,
    commandDefinitions: Object.values(tdpSyncV2CommandDefinitions),
    errorDefinitions: tdpSyncV2ErrorDefinitionList,
    parameterDefinitions: tdpSyncV2ParameterDefinitionList,
})
