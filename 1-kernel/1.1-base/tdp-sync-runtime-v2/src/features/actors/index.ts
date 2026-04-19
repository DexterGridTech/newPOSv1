import type {ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import type {TopicChangePublisherFingerprintV2} from '../../foundations/topicChangePublisher'
import {createTdpAutoConnectActorDefinitionV2} from './autoConnectActor'
import {createTdpInitializeActorDefinitionV2} from './initializeActor'
import {createTdpBootstrapActorDefinitionV2} from './bootstrapActor'
import {createTdpMessageActorDefinitionV2} from './messageActor'
import {createTdpProjectionRepositoryActorDefinitionV2} from './projectionRepositoryActor'
import {createTdpCursorFeedbackActorDefinitionV2} from './cursorFeedbackActor'
import {createTdpCommandInboxActorDefinitionV2} from './commandInboxActor'
import {createTdpCommandAckActorDefinitionV2} from './commandAckActor'
import {
    createTdpSessionConnectionActorDefinitionV2,
    type TdpSessionConnectionRuntimeRefV2,
} from './sessionConnectionActor'
import {createTdpSessionStateActorDefinitionV2} from './sessionStateActor'
import {createTdpTopicChangeActorDefinitionV2} from './topicChangeActor'
import {createTdpSystemCatalogBridgeActorDefinitionV2} from './systemCatalogBridgeActor'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../../types'

export * from './initializeActor'
export * from './autoConnectActor'
export * from './bootstrapActor'
export * from './messageActor'
export * from './projectionRepositoryActor'
export * from './cursorFeedbackActor'
export * from './commandInboxActor'
export * from './commandAckActor'
export * from './sessionConnectionActor'
export * from './sessionStateActor'
export * from './topicChangeActor'
export * from './systemCatalogBridgeActor'

export const createTdpSyncActorDefinitionsV2 = (
    fingerprintRef: TopicChangePublisherFingerprintV2,
    connectionRuntimeRef: TdpSessionConnectionRuntimeRefV2,
    moduleInput: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition[] => [
    createTdpInitializeActorDefinitionV2(moduleInput),
    createTdpAutoConnectActorDefinitionV2(moduleInput),
    createTdpBootstrapActorDefinitionV2(),
    createTdpSessionConnectionActorDefinitionV2(connectionRuntimeRef, moduleInput),
    createTdpMessageActorDefinitionV2(),
    createTdpProjectionRepositoryActorDefinitionV2(),
    createTdpCursorFeedbackActorDefinitionV2(),
    createTdpCommandInboxActorDefinitionV2(),
    createTdpCommandAckActorDefinitionV2(),
    createTdpSessionStateActorDefinitionV2(),
    createTdpTopicChangeActorDefinitionV2(fingerprintRef),
    createTdpSystemCatalogBridgeActorDefinitionV2(),
]
