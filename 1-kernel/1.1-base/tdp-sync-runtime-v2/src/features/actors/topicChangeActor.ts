import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {tcpControlV2CommandDefinitions} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {
    publishTopicDataChangesV2,
    type TopicChangePublisherFingerprintV2,
} from '../../foundations/topicChangePublisher'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../../types'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpTopicChangeActorDefinitionV2 = (
    fingerprintRef: TopicChangePublisherFingerprintV2,
    moduleInput: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition => defineActor('TdpTopicChangeActor', [
    onCommand(tcpControlV2CommandDefinitions.resetTcpControl, () => {
        fingerprintRef.byTopic = {}
        fingerprintRef.resolvedByTopic = {}
        return {
            reset: true,
        }
    }),
    onCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, async context => {
        const summary = await publishTopicDataChangesV2(context, fingerprintRef, {
            currentFacts: moduleInput.hotUpdate?.getCurrentFacts?.(context),
        })
        return {
            changedTopicCount: summary.changedTopicCount,
            changedTopics: summary.changedTopics,
        }
    }),
])
