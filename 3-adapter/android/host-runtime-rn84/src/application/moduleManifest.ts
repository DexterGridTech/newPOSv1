import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {releaseInfo} from '../generated/releaseInfo'

export const assemblyRuntimeModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion: releaseInfo.assemblyVersion,
        stateSlices: [],
        commandDefinitions: [],
        errorDefinitions: [],
        parameterDefinitions: [],
    })
