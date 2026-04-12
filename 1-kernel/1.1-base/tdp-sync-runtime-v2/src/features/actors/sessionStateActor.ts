import {nowTimestampMs, createAppError} from '@impos2/kernel-base-contracts'
import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'
import {tdpSyncV2ErrorDefinitions} from '../../supports'

export const createTdpSessionStateActorDefinitionV2 = (): ActorDefinition => ({
    moduleName,
    actorName: 'TdpSessionStateActor',
    handlers: [
        onCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, context => {
                const payload = context.command.payload
                context.dispatchAction(tdpSyncV2DomainActions.applySessionReady({
                    ...payload,
                    connectedAt: nowTimestampMs(),
                }))
                return {}
            },
        ),
        onCommand(tdpSyncV2CommandDefinitions.tdpPongReceived, context => {
                const payload = context.command.payload
                context.dispatchAction(tdpSyncV2DomainActions.applyPongReceived(payload))
                return {}
            },
        ),
        onCommand(tdpSyncV2CommandDefinitions.tdpEdgeDegraded, context => {
                const payload = context.command.payload
                context.dispatchAction(tdpSyncV2DomainActions.applyEdgeDegraded(payload))
                return {}
            },
        ),
        onCommand(tdpSyncV2CommandDefinitions.tdpSessionRehomeRequired, context => {
                const payload = context.command.payload
                context.dispatchAction(tdpSyncV2DomainActions.applySessionRehomeRequired(payload))
                return {}
            },
        ),
        onCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, context => {
                const payload = context.command.payload
                context.dispatchAction(tdpSyncV2DomainActions.applyProtocolFailed(
                    createAppError(tdpSyncV2ErrorDefinitions.protocolError, {
                        args: {error: payload.message},
                        details: payload.details,
                    }),
                ))
                return {}
            },
        ),
    ],
})
