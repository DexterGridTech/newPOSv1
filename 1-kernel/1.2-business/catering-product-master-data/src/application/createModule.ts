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
import {createCateringProductMasterDataActorDefinitions} from '../features/actors'
import {cateringProductMasterDataModuleManifest} from './moduleManifest'

export const cateringProductMasterDataPreSetup = async (
    context: RuntimeModulePreSetupContextV2,
): Promise<void> => {
    createRuntimeModuleLifecycleLogger({moduleName, context}).logPreSetup()
}

export const createCateringProductMasterDataModule = (): KernelRuntimeModuleV2 =>
    defineKernelRuntimeModuleV2({
        ...cateringProductMasterDataModuleManifest,
        actorDefinitions: createCateringProductMasterDataActorDefinitions(),
        preSetup: cateringProductMasterDataPreSetup,
        install(context: RuntimeModuleContextV2) {
            createRuntimeModuleLifecycleLogger({moduleName, context}).logInstall({
                stateSlices: cateringProductMasterDataModuleManifest.stateSliceNames,
                commandNames: cateringProductMasterDataModuleManifest.commandNames,
            })
        },
    })

export const cateringProductMasterDataModuleDescriptor =
    deriveKernelRuntimeModuleDescriptorV2(createCateringProductMasterDataModule)
