import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {selectTopologyRuntimeV3Context} from '../../selectors'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV3CommandDefinitions} from '../commands'
export {
    TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
    resolvePowerDisplaySwitchTarget,
} from '../../foundations/powerDisplaySwitch'

const defineActor = createModuleActorFactory(moduleName)

export const createTopologyRuntimeV3PowerDisplaySwitchActor = (): ActorDefinition => defineActor(
    'TopologyPowerDisplaySwitchActor',
    [
        onCommand(topologyRuntimeV3CommandDefinitions.confirmPowerDisplayModeSwitch, async context => {
            const currentContext = selectTopologyRuntimeV3Context(context.getState())
            if (currentContext?.standalone !== true || currentContext.instanceMode !== 'SLAVE') {
                return {
                    skipped: true,
                    reason: 'not-standalone-slave',
                }
            }
            await context.dispatchCommand(createCommand(
                topologyRuntimeV3CommandDefinitions.setDisplayMode,
                {
                    displayMode: context.command.payload.displayMode,
                },
            ))
            return {
                displayMode: context.command.payload.displayMode,
            }
        }),
    ],
)
