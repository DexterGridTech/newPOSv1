import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {adminConsoleCommandDefinitions} from '../features/commands'
import {adminConsoleStateSliceDescriptor} from '../features/slices'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'

export const adminConsoleModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    stateSlices: [adminConsoleStateSliceDescriptor],
    commandDefinitions: Object.values(adminConsoleCommandDefinitions),
    errorDefinitions: [],
    parameterDefinitions: [],
})
