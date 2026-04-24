import {createAppError} from '@next/kernel-base-contracts'
import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV3ErrorDefinitions} from '../../supports'
import type {TopologyPeerOrchestratorV3} from '../../types/runtime'
import {topologyRuntimeV3CommandDefinitions} from '../commands'

export interface TopologyRuntimeV3OrchestratorRef {
    current?: TopologyPeerOrchestratorV3
}

const getOrchestratorOrThrow = (
    ref: TopologyRuntimeV3OrchestratorRef,
    commandName: string,
) => {
    if (ref.current) {
        return ref.current
    }
    throw createAppError(topologyRuntimeV3ErrorDefinitions.orchestratorRequired, {
        args: {commandName},
    })
}

const defineActor = createModuleActorFactory(moduleName)

export const createTopologyRuntimeV3ConnectionActor = (
    orchestratorRef: TopologyRuntimeV3OrchestratorRef,
): ActorDefinition => defineActor('TopologyConnectionActor', [
    onCommand(topologyRuntimeV3CommandDefinitions.startTopologyConnection, async () => {
        await getOrchestratorOrThrow(
            orchestratorRef,
            topologyRuntimeV3CommandDefinitions.startTopologyConnection.commandName,
        ).startConnection()
    }),
    onCommand(topologyRuntimeV3CommandDefinitions.stopTopologyConnection, () => {
        getOrchestratorOrThrow(
            orchestratorRef,
            topologyRuntimeV3CommandDefinitions.stopTopologyConnection.commandName,
        ).stopConnection('command-stop')
    }),
    onCommand(topologyRuntimeV3CommandDefinitions.restartTopologyConnection, async () => {
        await getOrchestratorOrThrow(
            orchestratorRef,
            topologyRuntimeV3CommandDefinitions.restartTopologyConnection.commandName,
        ).restartConnection('command-restart')
    }),
])
