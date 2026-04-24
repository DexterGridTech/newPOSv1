import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName as uiRuntimeV2ModuleName} from '@next/kernel-base-ui-runtime-v2'
import {moduleName as runtimeReactModuleName} from '@next/ui-base-runtime-react'
import {moduleName as organizationIamModuleName} from '@next/kernel-business-organization-iam-master-data'
import {moduleName as cateringProductModuleName} from '@next/kernel-business-catering-product-master-data'
import {moduleName as cateringStoreOperatingModuleName} from '@next/kernel-business-catering-store-operating-master-data'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'

export const masterDataWorkbenchModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        dependencies: [
            {moduleName: uiRuntimeV2ModuleName},
            {moduleName: runtimeReactModuleName},
            {moduleName: organizationIamModuleName},
            {moduleName: cateringProductModuleName},
            {moduleName: cateringStoreOperatingModuleName},
        ],
    })
