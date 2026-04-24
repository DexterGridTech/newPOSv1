import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'

export const cateringShellModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        stateSlices: [],
        commandDefinitions: [],
        errorDefinitions: [],
        parameterDefinitions: [],
    })
