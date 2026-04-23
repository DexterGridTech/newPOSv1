import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {createOrganizationIamMasterDataActorDefinitions} from '../features/actors'
import {organizationIamMasterDataModuleManifest} from './moduleManifest'

export const organizationIamMasterDataPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createOrganizationIamMasterDataModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...organizationIamMasterDataModuleManifest,
        actorDefinitions: createOrganizationIamMasterDataActorDefinitions(),
        preSetup: organizationIamMasterDataPreSetup,
        install(context: RuntimeModuleContextV2) {
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: organizationIamMasterDataModuleManifest.stateSliceNames,
                commandNames: organizationIamMasterDataModuleManifest.commandNames,
            })
        },
    })

export const organizationIamMasterDataModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(createOrganizationIamMasterDataModule)
