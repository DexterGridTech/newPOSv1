import type {ActorDefinition} from '@next/kernel-base-runtime-shell-v2'
import {createTcpActivationActorDefinitionV2} from './activationActor'
import {createTcpBootstrapActorDefinitionV2} from './bootstrapActor'
import {createTcpCredentialActorDefinitionV2} from './credentialActor'
import {createTcpDeactivationActorDefinitionV2} from './deactivationActor'
import {createTcpStateMutationActorDefinitionV2} from './stateMutationActor'
import {createTcpTaskReportActorDefinitionV2} from './taskReportActor'
import type {TcpControlServiceRefV2} from './serviceRef'

export * from './activationActor'
export * from './bootstrapActor'
export * from './credentialActor'
export * from './deactivationActor'
export * from './stateMutationActor'
export * from './taskReportActor'
export * from './serviceRef'

export const createTcpControlActorDefinitionsV2 = (
    serviceRef: TcpControlServiceRefV2,
): ActorDefinition[] => [
    createTcpBootstrapActorDefinitionV2(serviceRef),
    createTcpActivationActorDefinitionV2(serviceRef),
    createTcpCredentialActorDefinitionV2(serviceRef),
    createTcpDeactivationActorDefinitionV2(serviceRef),
    createTcpTaskReportActorDefinitionV2(serviceRef),
    createTcpStateMutationActorDefinitionV2(),
]
