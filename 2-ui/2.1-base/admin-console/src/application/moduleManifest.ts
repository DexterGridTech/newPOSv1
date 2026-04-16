import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {adminConsoleStateSliceDescriptor} from '../features/slices'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'

export const adminConsoleModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    stateSlices: [adminConsoleStateSliceDescriptor],
    commandDefinitions: [],
    errorDefinitions: [],
    parameterDefinitions: [],
})
