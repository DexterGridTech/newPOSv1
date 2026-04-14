import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    runtimeShellV2CommandDefinitions,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV2CommandDefinitions} from '../commands'
import {topologyRuntimeV2ParameterDefinitions} from '../../supports'
import {TOPOLOGY_V2_RECOVERY_STATE_KEY} from '../../foundations/stateKeys'

const shouldAutoConnect = (state: Record<string, unknown> | undefined) => {
    const recoveryState = state?.[TOPOLOGY_V2_RECOVERY_STATE_KEY] as
        | {instanceMode?: string; masterInfo?: unknown; enableSlave?: boolean}
        | undefined
    return recoveryState?.instanceMode === 'SLAVE'
        ? Boolean(recoveryState.masterInfo)
        : recoveryState?.enableSlave === true
}

const defineActor = createModuleActorFactory(moduleName)

export const createTopologyRuntimeV2InitializeActor = (): ActorDefinition => defineActor(
    'TopologyInitializeActor',
    [
        onCommand(runtimeShellV2CommandDefinitions.initialize, async context => {
            if (!shouldAutoConnect(context.getState() as Record<string, unknown> | undefined)) {
                return {
                    autoConnectScheduled: false,
                }
            }

            const recoveryState = context.getState()?.[TOPOLOGY_V2_RECOVERY_STATE_KEY as keyof ReturnType<typeof context.getState>] as
                | {instanceMode?: string}
                | undefined
            const delayMs = recoveryState?.instanceMode === 'SLAVE'
                ? context.resolveParameter({
                    key: topologyRuntimeV2ParameterDefinitions.slaveConnectDelayMs.key,
                    definition: topologyRuntimeV2ParameterDefinitions.slaveConnectDelayMs,
                }).value
                : context.resolveParameter({
                    key: topologyRuntimeV2ParameterDefinitions.masterServerBootstrapDelayMs.key,
                    definition: topologyRuntimeV2ParameterDefinitions.masterServerBootstrapDelayMs,
                }).value

            setTimeout(() => {
                void context.dispatchCommand(createCommand(
                    topologyRuntimeV2CommandDefinitions.startTopologyConnection,
                    {},
                )).catch(() => {
                    // Auto-connect follows runtime bootstrap semantics: failures surface through state/logging,
                    // but should not break runtime-shell initialize.
                })
            }, delayMs)

            return {
                autoConnectScheduled: true,
                delayMs,
            }
        }),
    ],
)
