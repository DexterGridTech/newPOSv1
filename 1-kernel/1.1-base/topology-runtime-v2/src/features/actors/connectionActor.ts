import {createAppError} from '@impos2/kernel-base-contracts'
import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV2CommandDefinitions} from '../commands'
import {topologyRuntimeV2ErrorDefinitions} from '../../supports'
import type {TopologyPeerOrchestratorV2} from '../../types'

export interface TopologyRuntimeV2OrchestratorRef {
    current?: TopologyPeerOrchestratorV2
}

const getOrchestratorOrThrow = (
    ref: TopologyRuntimeV2OrchestratorRef,
    commandName: string,
) => {
    if (ref.current) {
        return ref.current
    }
    throw createAppError(topologyRuntimeV2ErrorDefinitions.assemblyRequired, {
        args: {commandName},
    })
}

export const createTopologyRuntimeV2ConnectionActor = (
    orchestratorRef: TopologyRuntimeV2OrchestratorRef,
): ActorDefinition => ({
    moduleName,
    actorName: 'TopologyConnectionActor',
    handlers: [
        onCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, async () => {
            await getOrchestratorOrThrow(orchestratorRef, topologyRuntimeV2CommandDefinitions.startTopologyConnection.commandName).startConnection()
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.stopTopologyConnection, () => {
            getOrchestratorOrThrow(orchestratorRef, topologyRuntimeV2CommandDefinitions.stopTopologyConnection.commandName).stopConnection('command-stop')
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.restartTopologyConnection, async () => {
            await getOrchestratorOrThrow(orchestratorRef, topologyRuntimeV2CommandDefinitions.restartTopologyConnection.commandName).restartConnection('command-restart')
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.resumeTopologySession, context => {
            getOrchestratorOrThrow(orchestratorRef, topologyRuntimeV2CommandDefinitions.resumeTopologySession.commandName).beginResume()
            return {
                requestId: context.command.requestId,
            }
        }),
    ],
})
