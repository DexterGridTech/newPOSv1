import {moduleName as tdpSyncRuntimeV2ModuleName} from '@impos2/kernel-base-tdp-sync-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {workflowRuntimeV2CommandDefinitions} from '../features/commands'
import {workflowRuntimeV2StateSlices} from '../features/slices'
import {
    workflowRuntimeV2ErrorDefinitionList,
    workflowRuntimeV2ParameterDefinitionList,
} from '../supports'

export const workflowRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    dependencies: [
        {
            moduleName: tdpSyncRuntimeV2ModuleName,
            optional: true,
        },
    ],
    stateSlices: workflowRuntimeV2StateSlices,
    commandDefinitions: Object.values(workflowRuntimeV2CommandDefinitions),
    errorDefinitions: workflowRuntimeV2ErrorDefinitionList,
    parameterDefinitions: workflowRuntimeV2ParameterDefinitionList,
})
