import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {terminalLogUploadRuntimeV2CommandDefinitions} from '../features/commands'
import {terminalLogUploadRuntimeV2ErrorDefinitionList} from '../supports/errors'

export const terminalLogUploadRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        stateSlices: [],
        commandDefinitions: Object.values(terminalLogUploadRuntimeV2CommandDefinitions),
        errorDefinitions: terminalLogUploadRuntimeV2ErrorDefinitionList,
        parameterDefinitions: [],
    })
