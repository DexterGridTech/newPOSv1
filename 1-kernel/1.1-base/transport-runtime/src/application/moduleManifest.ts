import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {transportRuntimeCommandDefinitions} from '../features/commands'
import {transportRuntimeStateSlices} from '../features/slices'

export const transportRuntimeModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        stateSlices: transportRuntimeStateSlices,
        commandDefinitions: Object.values(transportRuntimeCommandDefinitions),
    })
