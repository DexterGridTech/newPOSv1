import {moduleName as organizationIamModuleName} from '@next/kernel-business-organization-iam-master-data'
import {moduleName as tdpSyncRuntimeV2ModuleName} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {cateringProductMasterDataCommandDefinitions} from '../features/commands'
import {cateringProductMasterDataStateSlices} from '../features/slices'

export const cateringProductMasterDataModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        dependencies: [
            {moduleName: tdpSyncRuntimeV2ModuleName},
            {moduleName: organizationIamModuleName, optional: true},
        ],
        stateSlices: cateringProductMasterDataStateSlices,
        commandDefinitions: Object.values(cateringProductMasterDataCommandDefinitions),
    })
