import {moduleName as tdpSyncRuntimeV2ModuleName} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {organizationIamMasterDataCommandDefinitions} from '../features/commands'
import {organizationIamMasterDataStateSlices} from '../features/slices'

export const organizationIamMasterDataModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        dependencies: [
            {
                moduleName: tdpSyncRuntimeV2ModuleName,
            },
        ],
        stateSlices: organizationIamMasterDataStateSlices,
        commandDefinitions: Object.values(organizationIamMasterDataCommandDefinitions),
    })
