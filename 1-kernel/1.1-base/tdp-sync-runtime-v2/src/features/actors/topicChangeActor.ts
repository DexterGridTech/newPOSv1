import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {
    publishTopicDataChangesV2,
    type TopicChangePublisherFingerprintV2,
} from '../../foundations/topicChangePublisher'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpTopicChangeActorDefinitionV2 = (
    fingerprintRef: TopicChangePublisherFingerprintV2,
): ActorDefinition => defineActor('TdpTopicChangeActor', [
    onCommand(tdpSyncV2CommandDefinitions.recomputeResolvedTopicChanges, async context => {
        const summary = await publishTopicDataChangesV2(context, fingerprintRef)
        return {
            changedTopicCount: summary.changedTopicCount,
            changedTopics: summary.changedTopics,
        }
    }),
])
