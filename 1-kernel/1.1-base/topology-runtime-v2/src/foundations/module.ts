import type {KernelRuntimeModuleV2} from '@impos2/kernel-base-runtime-shell-v2'
import {packageVersion} from '../generated/packageVersion'
import {moduleName} from '../moduleName'
import {createTopologyRuntimeV2ActorDefinitions, type TopologyRuntimeV2OrchestratorRef} from '../features/actors'
import {topologyRuntimeV2CommandDefinitions} from '../features/commands'
import {topologyRuntimeV2StateActions, topologyRuntimeV2StateSlices} from '../features/slices'
import {
    topologyRuntimeV2ErrorDefinitionList,
    topologyRuntimeV2ParameterDefinitionList,
} from '../supports'
import type {CreateTopologyRuntimeModuleV2Input} from '../types'
import {createTopologyContextState} from './context'
import {createTopologyPeerOrchestratorV2} from './orchestrator'
import {TOPOLOGY_V2_RECOVERY_STATE_KEY} from './stateKeys'

export const createTopologyRuntimeModuleV2 = (
    input: CreateTopologyRuntimeModuleV2Input = {},
): KernelRuntimeModuleV2 => {
    const orchestratorRef: TopologyRuntimeV2OrchestratorRef = {}

    return {
        moduleName,
        packageVersion,
        stateSlices: topologyRuntimeV2StateSlices,
        commandDefinitions: Object.values(topologyRuntimeV2CommandDefinitions),
        actorDefinitions: createTopologyRuntimeV2ActorDefinitions(orchestratorRef),
        errorDefinitions: topologyRuntimeV2ErrorDefinitionList,
        parameterDefinitions: topologyRuntimeV2ParameterDefinitionList,
        install(context) {
            let lastContextFingerprint = ''
            const syncContextState = () => {
                const recoveryState = context.getState()?.[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof ReturnType<typeof context.getState>] as any
                const nextContext = createTopologyContextState({
                    localNodeId: context.localNodeId,
                    recoveryState: recoveryState ?? {},
                })
                const nextFingerprint = JSON.stringify(nextContext)
                if (nextFingerprint === lastContextFingerprint) {
                    return
                }
                lastContextFingerprint = nextFingerprint
                context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(nextContext))
            }

            syncContextState()
            context.subscribeState(syncContextState)

            if (input.assembly) {
                const orchestrator = createTopologyPeerOrchestratorV2({
                    context,
                    assembly: input.assembly,
                    reconnectAttemptsOverride: input.socket?.reconnectAttempts,
                })
                orchestratorRef.current = orchestrator
                context.installPeerDispatchGateway(orchestrator.gateway)
            }

            context.platformPorts.logger.info({
                category: 'runtime.load',
                event: 'topology-runtime-v2-install',
                message: 'install topology runtime v2 contents',
                data: {
                    moduleName,
                    stateSlices: topologyRuntimeV2StateSlices.map(slice => slice.name),
                    commandNames: Object.values(topologyRuntimeV2CommandDefinitions).map(item => item.commandName),
                    hasAssembly: Boolean(input.assembly),
                },
            })
        },
    }
}
