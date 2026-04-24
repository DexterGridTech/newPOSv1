import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

export const createTdpMessageActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TdpMessageActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpMessageReceived, async context => {
            const message = context.command.payload
            switch (message.type) {
                case 'SESSION_READY':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, message.data))
                    return {type: message.type}
                case 'FULL_SNAPSHOT':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSnapshotLoaded, {
                        snapshot: message.data.snapshot,
                        highWatermark: message.data.highWatermark,
                    }))
                    return {type: message.type}
                case 'CHANGESET':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpChangesLoaded, {
                        changes: message.data.changes,
                        nextCursor: message.data.nextCursor,
                        highWatermark: message.data.highWatermark,
                    }))
                    return {type: message.type}
                case 'PROJECTION_CHANGED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionReceived, {
                        cursor: message.data.cursor,
                        change: message.data.change,
                    }))
                    return {type: message.type}
                case 'PROJECTION_BATCH':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProjectionBatchReceived, {
                        changes: message.data.changes,
                        nextCursor: message.data.nextCursor,
                    }))
                    return {type: message.type}
                case 'COMMAND_DELIVERED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpCommandDelivered, message.data))
                    return {type: message.type}
                case 'PONG':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpPongReceived, message.data))
                    return {type: message.type}
                case 'EDGE_DEGRADED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpEdgeDegraded, message.data))
                    return {type: message.type}
                case 'SESSION_REHOME_REQUIRED':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpSessionRehomeRequired, message.data))
                    return {type: message.type}
                case 'ERROR':
                    await context.dispatchCommand(createCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, message.error))
                    return {type: message.type}
                default:
                    return {type: 'UNKNOWN'}
            }
        }),
    ],
)
