import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import type {TopicChangePublisherFingerprintV2} from '../../foundations/topicChangePublisher'
import {createTdpAutoConnectActorDefinitionV2} from './autoConnectActor'
import {createTdpInitializeActorDefinitionV2} from './initializeActor'
import {createTdpBootstrapActorDefinitionV2} from './bootstrapActor'
import {createTdpMessageActorDefinitionV2} from './messageActor'
import {createTdpProjectionRepositoryActorDefinitionV2} from './projectionRepositoryActor'
import {
    createTdpBatchFeedbackActorDefinitionV2,
    createTdpCursorFeedbackActorDefinitionV2,
} from './cursorFeedbackActor'
import {createTdpChangesFetchActorDefinitionV2} from './changesFetchActor'
import {createTdpCommandInboxActorDefinitionV2} from './commandInboxActor'
import {createTdpCommandAckActorDefinitionV2} from './commandAckActor'
import {
    createTdpSessionConnectionActorDefinitionV2,
    type TdpSessionConnectionRuntimeRefV2,
} from './sessionConnectionActor'
import {createTdpSessionStateActorDefinitionV2} from './sessionStateActor'
import {createTdpTopicChangeActorDefinitionV2} from './topicChangeActor'
import {createTdpTerminalLogUploadCommandRouterActorDefinitionV2} from './terminalLogUploadCommandRouterActor'
import {createTdpSystemCatalogBridgeActorDefinitionV2} from './systemCatalogBridgeActor'
import {createTdpUserOperationActorDefinitionV2} from './userOperationActor'
import {createTdpHotUpdateNativeBootActorDefinitionV2} from './hotUpdateNativeBootActor'
import {createTdpTcpResetActorDefinitionV2} from './tcpResetActor'
import type {CreateTdpSyncRuntimeModuleV2Input, TdpSyncHttpServiceRefV2} from '../../types'

export * from './initializeActor'
export * from './autoConnectActor'
export * from './bootstrapActor'
export * from './messageActor'
export * from './projectionRepositoryActor'
export * from './cursorFeedbackActor'
export * from './changesFetchActor'
export * from './commandInboxActor'
export * from './commandAckActor'
export * from './sessionConnectionActor'
export * from './sessionStateActor'
export * from './topicChangeActor'
export * from './terminalLogUploadCommandRouterActor'
export * from './systemCatalogBridgeActor'
export * from './userOperationActor'
export * from './hotUpdateNativeBootActor'
export * from './tcpResetActor'

export const createTdpSyncActorDefinitionsV2 = (
    fingerprintRef: TopicChangePublisherFingerprintV2,
    connectionRuntimeRef: TdpSessionConnectionRuntimeRefV2,
    httpServiceRef: TdpSyncHttpServiceRefV2,
    moduleInput: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition[] => [
    createTdpInitializeActorDefinitionV2(moduleInput),
    createTdpAutoConnectActorDefinitionV2(moduleInput),
    createTdpBootstrapActorDefinitionV2(),
    createTdpSessionConnectionActorDefinitionV2(connectionRuntimeRef, moduleInput),
    createTdpMessageActorDefinitionV2(),
    createTdpProjectionRepositoryActorDefinitionV2(),
    createTdpCursorFeedbackActorDefinitionV2(),
    createTdpBatchFeedbackActorDefinitionV2(connectionRuntimeRef),
    createTdpChangesFetchActorDefinitionV2(httpServiceRef),
    createTdpCommandInboxActorDefinitionV2(),
    createTdpCommandAckActorDefinitionV2(),
    createTdpTcpResetActorDefinitionV2(),
    createTdpTerminalLogUploadCommandRouterActorDefinitionV2(),
    createTdpSessionStateActorDefinitionV2(connectionRuntimeRef),
    createTdpTopicChangeActorDefinitionV2(fingerprintRef, moduleInput),
    createTdpSystemCatalogBridgeActorDefinitionV2(),
    createTdpUserOperationActorDefinitionV2(),
    createTdpHotUpdateNativeBootActorDefinitionV2(),
]
