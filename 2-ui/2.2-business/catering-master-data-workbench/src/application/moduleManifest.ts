import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName as uiRuntimeV2ModuleName} from '@impos2/kernel-base-ui-runtime-v2'
import {moduleName as runtimeReactModuleName} from '@impos2/ui-base-runtime-react'
import {moduleName as organizationIamModuleName} from '@impos2/kernel-business-organization-iam-master-data'
import {moduleName as cateringProductModuleName} from '@impos2/kernel-business-catering-product-master-data'
import {moduleName as cateringStoreOperatingModuleName} from '@impos2/kernel-business-catering-store-operating-master-data'
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
