import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {topologyRuntimeV2CommandDefinitions} from '../commands'
import {topologyRuntimeV2StateActions} from '../slices'
import {moduleName} from '../../moduleName'
import {createTopologyContextState} from '../../foundations/context'
import {TOPOLOGY_V2_RECOVERY_STATE_KEY} from '../../foundations/stateKeys'

const buildContextState = (context: Parameters<NonNullable<ActorDefinition['handlers']>[number]['handle']>[0]) => {
    const recoveryState = context.getState()?.[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof ReturnType<typeof context.getState>] as any
    return createTopologyContextState({
        localNodeId: context.localNodeId,
        recoveryState: recoveryState ?? {},
    })
}

const defineActor = createModuleActorFactory(moduleName)

export const createTopologyRuntimeV2ContextActor = (): ActorDefinition => defineActor(
    'TopologyContextActor',
    [
        onCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, context => {
            context.dispatchAction(topologyRuntimeV2StateActions.updateRecoveryState({
                instanceMode: context.command.payload.instanceMode,
            }))
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, context => {
            context.dispatchAction(topologyRuntimeV2StateActions.updateRecoveryState({
                displayMode: context.command.payload.displayMode,
            }))
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, context => {
            context.dispatchAction(topologyRuntimeV2StateActions.updateRecoveryState({
                enableSlave: context.command.payload.enableSlave,
            }))
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, context => {
            context.dispatchAction(topologyRuntimeV2StateActions.updateRecoveryState({
                masterInfo: context.command.payload.masterInfo,
            }))
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.clearMasterInfo, context => {
            context.dispatchAction(topologyRuntimeV2StateActions.updateRecoveryState({
                masterInfo: null,
            }))
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV2CommandDefinitions.refreshTopologyContext, context => {
            const nextContext = buildContextState(context)
            context.dispatchAction(topologyRuntimeV2StateActions.replaceContextState(nextContext))
            return {
                context: nextContext,
            }
        }),
    ],
)
