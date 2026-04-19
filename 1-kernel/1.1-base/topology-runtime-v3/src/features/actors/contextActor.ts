import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {createAppError} from '@impos2/kernel-base-contracts'
import {moduleName} from '../../moduleName'
import {
    getTopologyV3DisplayModeEligibility,
    getTopologyV3EnableSlaveEligibility,
    getTopologyV3SwitchToSlaveEligibility,
} from '../../foundations/eligibility'
import {deriveTopologyV3RuntimeContext} from '../../foundations/runtimeDerivation'
import {TOPOLOGY_V3_CONFIG_STATE_KEY} from '../../foundations/stateKeys'
import {topologyRuntimeV3ErrorDefinitions} from '../../supports'
import {topologyRuntimeV3CommandDefinitions} from '../commands'
import {topologyRuntimeV3StateActions} from '../slices'
import type {TopologyV3ConfigRuntimeState} from '../../types/state'

const buildContextState = (
    context: Parameters<NonNullable<ActorDefinition['handlers']>[number]['handle']>[0],
) => {
    const configState = context.getState()?.[
        TOPOLOGY_V3_CONFIG_STATE_KEY as keyof ReturnType<typeof context.getState>
    ] as TopologyV3ConfigRuntimeState | undefined

    return {
        ...deriveTopologyV3RuntimeContext({
            displayIndex: context.displayContext.displayIndex,
            displayCount: context.displayContext.displayCount,
            configState: configState ?? {},
        }),
        localNodeId: context.localNodeId,
    }
}

const defineActor = createModuleActorFactory(moduleName)

const readActivationStatus = (
    state: ReturnType<Parameters<NonNullable<ActorDefinition['handlers']>[number]['handle']>[0]['getState']>,
): 'UNACTIVATED' | 'ACTIVATED' | undefined => {
    const identityState = (state as Record<string, unknown>)['kernel.base.tcp-control-runtime-v2.identity'] as {
        activationStatus?: 'UNACTIVATED' | 'ACTIVATED'
    } | undefined
    return identityState?.activationStatus
}

const assertActionAllowed = (
    input: {
        allowed: boolean
        commandName: string
        reasonCode: string
    },
) => {
    if (input.allowed) {
        return
    }
    throw createAppError(topologyRuntimeV3ErrorDefinitions.actionNotAllowed, {
        args: {
            commandName: input.commandName,
            reasonCode: input.reasonCode,
        },
    })
}

export const createTopologyRuntimeV3ContextActor = (): ActorDefinition => defineActor(
    'TopologyContextActor',
    [
        onCommand(topologyRuntimeV3CommandDefinitions.setInstanceMode, context => {
            if (context.command.payload.instanceMode === 'SLAVE') {
                const eligibility = getTopologyV3SwitchToSlaveEligibility({
                    context: buildContextState(context),
                    activationStatus: readActivationStatus(context.getState()),
                })
                assertActionAllowed({
                    ...eligibility,
                    commandName: topologyRuntimeV3CommandDefinitions.setInstanceMode.commandName,
                })
            }
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                instanceMode: context.command.payload.instanceMode,
            }))
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.setDisplayMode, context => {
            const eligibility = getTopologyV3DisplayModeEligibility({
                context: buildContextState(context),
            })
            assertActionAllowed({
                ...eligibility,
                commandName: topologyRuntimeV3CommandDefinitions.setDisplayMode.commandName,
            })
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                displayMode: context.command.payload.displayMode,
            }))
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.setEnableSlave, context => {
            const eligibility = getTopologyV3EnableSlaveEligibility({
                context: buildContextState(context),
            })
            assertActionAllowed({
                ...eligibility,
                commandName: topologyRuntimeV3CommandDefinitions.setEnableSlave.commandName,
            })
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                enableSlave: context.command.payload.enableSlave,
            }))
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.setMasterLocator, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                masterLocator: context.command.payload.masterLocator,
            }))
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.clearMasterLocator, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.patchConfigState({
                masterLocator: null,
            }))
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(buildContextState(context)))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.refreshTopologyContext, context => {
            const nextContext = buildContextState(context)
            context.dispatchAction(topologyRuntimeV3StateActions.replaceContextState(nextContext))
            return {
                context: nextContext,
            }
        }),
    ],
)
