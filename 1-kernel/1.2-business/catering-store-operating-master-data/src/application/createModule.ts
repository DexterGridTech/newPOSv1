import type {
    KernelRuntimeModuleV2,
    RuntimeModuleContextV2,
    RuntimeModulePreSetupContextV2,
} from '@next/kernel-base-runtime-shell-v2'
import {
    createRuntimeModuleLifecycleLogger,
    defineKernelRuntimeModuleV2,
    deriveKernelRuntimeModuleDescriptorV2,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../moduleName'
import {createCateringStoreOperatingMasterDataActorDefinitions} from '../features/actors'
import {cateringStoreOperatingMasterDataModuleManifest} from './moduleManifest'

export const cateringStoreOperatingMasterDataPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createCateringStoreOperatingMasterDataModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...cateringStoreOperatingMasterDataModuleManifest,
        actorDefinitions: createCateringStoreOperatingMasterDataActorDefinitions(),
        preSetup: cateringStoreOperatingMasterDataPreSetup,
        install(context: RuntimeModuleContextV2) {
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: cateringStoreOperatingMasterDataModuleManifest.stateSliceNames,
                commandNames: cateringStoreOperatingMasterDataModuleManifest.commandNames,
            })
        },
    })

export const cateringStoreOperatingMasterDataModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(createCateringStoreOperatingMasterDataModule)
