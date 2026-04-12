import {createAppError} from '@impos2/kernel-base-contracts'
import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV2CommandDefinitions} from '../commands'
import {topologyRuntimeV2ErrorDefinitions} from '../../supports'
import type {TopologyPeerOrchestratorV2} from '../../types'
import type {TopologyRuntimeV2OrchestratorRef} from './connectionActor'

const getOrchestratorOrThrow = (
    ref: TopologyRuntimeV2OrchestratorRef,
    commandName: string,
): TopologyPeerOrchestratorV2 => {
    if (ref.current) {
        return ref.current
    }
    throw createAppError(topologyRuntimeV2ErrorDefinitions.assemblyRequired, {
        args: {commandName},
    })
}

export const createTopologyRuntimeV2DispatchActor = (
    orchestratorRef: TopologyRuntimeV2OrchestratorRef,
): ActorDefinition => ({
    moduleName,
    actorName: 'TopologyDispatchActor',
    handlers: [
        onCommand(topologyRuntimeV2CommandDefinitions.dispatchPeerCommand, async context => {
            return {
                ...await getOrchestratorOrThrow(
                orchestratorRef,
                topologyRuntimeV2CommandDefinitions.dispatchPeerCommand.commandName,
                ).dispatchRemoteCommand(context.command.payload),
            }
        }),
    ],
})
