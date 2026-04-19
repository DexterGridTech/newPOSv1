import {
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {topologyRuntimeV3CommandDefinitions} from '../commands'
import {topologyRuntimeV3StateActions} from '../slices'

const defineActor = createModuleActorFactory(moduleName)

export const createTopologyRuntimeV3DemoSyncActor = (): ActorDefinition => defineActor(
    'TopologyDemoSyncActor',
    [
        onCommand(topologyRuntimeV3CommandDefinitions.upsertDemoMasterEntry, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.upsertDemoMasterEntry({
                entryKey: context.command.payload.entryKey,
                updatedAt: context.command.payload.updatedAt,
                value: {
                    label: context.command.payload.label,
                    phase: context.command.payload.phase,
                    note: context.command.payload.note,
                    updatedBy: 'MASTER',
                },
            }))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.removeDemoMasterEntry, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.removeDemoMasterEntry({
                entryKey: context.command.payload.entryKey,
            }))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.resetDemoMasterState, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.resetDemoMasterState())
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.upsertDemoSlaveEntry, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.upsertDemoSlaveEntry({
                entryKey: context.command.payload.entryKey,
                updatedAt: context.command.payload.updatedAt,
                value: {
                    label: context.command.payload.label,
                    phase: context.command.payload.phase,
                    note: context.command.payload.note,
                    updatedBy: 'SLAVE',
                },
            }))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.removeDemoSlaveEntry, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.removeDemoSlaveEntry({
                entryKey: context.command.payload.entryKey,
            }))
        }),
        onCommand(topologyRuntimeV3CommandDefinitions.resetDemoSlaveState, context => {
            context.dispatchAction(topologyRuntimeV3StateActions.resetDemoSlaveState())
        }),
    ],
)
