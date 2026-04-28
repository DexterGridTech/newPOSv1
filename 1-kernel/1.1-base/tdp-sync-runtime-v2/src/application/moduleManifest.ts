import {moduleName as tcpControlRuntimeV2ModuleName} from '@next/kernel-base-tcp-control-runtime-v2'
import {
    defineKernelRuntimeModuleManifestV2,
    type KernelRuntimeModuleManifestV2,
} from '@next/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {tdpSyncV2CommandDefinitions} from '../features/commands'
import {tdpSyncV2StateSlices} from '../features/slices'
import {
    tdpSyncV2ErrorDefinitionList,
    tdpSyncV2ParameterDefinitionList,
} from '../supports'
import {TDP_HOT_UPDATE_TOPIC} from '../foundations/hotUpdateTopic'
import {TDP_SYSTEM_TOPIC_KEYS} from '../foundations/topicChangePublisher'

const TDP_SYNC_RUNTIME_TOPIC_INTERESTS = [
    {
        topicKey: TDP_SYSTEM_TOPIC_KEYS.errorCatalog,
        category: 'system',
        required: true,
        reason: 'runtime-shell remote error catalog bridge',
    },
    {
        topicKey: TDP_SYSTEM_TOPIC_KEYS.parameterCatalog,
        category: 'system',
        required: true,
        reason: 'runtime-shell remote parameter catalog bridge',
    },
    {
        topicKey: TDP_HOT_UPDATE_TOPIC,
        category: 'system',
        required: true,
        reason: 'terminal hot update desired state',
    },
    {
        topicKey: 'terminal.group.membership',
        category: 'system',
        required: true,
        reason: 'terminal group membership for projection scope resolution',
    },
    {
        topicKey: 'config.delta',
        category: 'system',
        required: false,
        reason: 'base runtime configuration delta used by live recovery tests and diagnostics',
    },
] as const

export const tdpSyncRuntimeV2ModuleManifest: KernelRuntimeModuleManifestV2 =
    defineKernelRuntimeModuleManifestV2({
    moduleName,
    packageVersion,
    dependencies: [
        {
            moduleName: tcpControlRuntimeV2ModuleName,
        },
    ],
    stateSlices: tdpSyncV2StateSlices,
    commandDefinitions: Object.values(tdpSyncV2CommandDefinitions),
    errorDefinitions: tdpSyncV2ErrorDefinitionList,
    parameterDefinitions: tdpSyncV2ParameterDefinitionList,
    tdpTopicInterests: TDP_SYNC_RUNTIME_TOPIC_INTERESTS,
})
