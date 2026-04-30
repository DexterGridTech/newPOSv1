import {moduleName as tdpSyncRuntimeV2ModuleName} from '@next/kernel-base-tdp-sync-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {benefitSessionCommandDefinitions} from '../features/commands'
import {benefitSessionStateSlices} from '../features/slices'
import {benefitSessionTopicList} from '../foundations/topics'
import {benefitSessionErrorDefinitionList} from '../supports'

export const benefitSessionModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
        moduleName,
        packageVersion,
        dependencies: [
            {moduleName: tdpSyncRuntimeV2ModuleName, optional: true},
        ],
        stateSlices: benefitSessionStateSlices,
        commandDefinitions: Object.values(benefitSessionCommandDefinitions),
        errorDefinitions: benefitSessionErrorDefinitionList,
        tdpTopicInterests: benefitSessionTopicList.map(topicKey => ({
            topicKey,
            category: 'projection',
            required: true,
            reason: 'transaction benefit template and activity projections',
        })),
    })
