import {nowTimestampMs, createAppError} from '@next/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@next/kernel-base-runtime-shell-v2'
import {
    selectTcpCredentialSnapshot,
    tcpControlV2CommandDefinitions,
} from '@next/kernel-base-tcp-control-runtime-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2DomainActions} from '../slices'
import {tdpSyncV2ErrorDefinitions} from '../../supports'
import type {TdpSessionConnectionRuntimeRefV2} from './sessionConnectionActor'

const defineActor = createModuleActorFactory(moduleName)

const recoverableCredentialProtocolErrorCodes = new Set([
    'TOKEN_EXPIRED',
    'INVALID_TOKEN',
])

export const createTdpSessionStateActorDefinitionV2 = (
    connectionRuntimeRef?: TdpSessionConnectionRuntimeRefV2,
): ActorDefinition => defineActor(
    'TdpSessionStateActor',
    [
        onCommand(tdpSyncV2CommandDefinitions.tdpSessionReady, context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applySessionReady({
                ...payload,
                connectedAt: nowTimestampMs(),
            }))
            return {}
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpPongReceived, context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyPongReceived(payload))
            return {}
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpEdgeDegraded, context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyEdgeDegraded(payload))
            return {}
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpSessionRehomeRequired, context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applySessionRehomeRequired(payload))
            return {}
        }),
        onCommand(tdpSyncV2CommandDefinitions.tdpProtocolFailed, context => {
            const payload = context.command.payload
            context.dispatchAction(tdpSyncV2DomainActions.applyProtocolFailed(
                createAppError(tdpSyncV2ErrorDefinitions.protocolError, {
                    args: {error: payload.message},
                    details: payload.details,
                }),
            ))
            const credential = selectTcpCredentialSnapshot(context.getState())
            if (
                recoverableCredentialProtocolErrorCodes.has(payload.code)
                && credential.refreshToken
                && credential.status !== 'REFRESHING'
            ) {
                connectionRuntimeRef?.current?.disconnect(`credential-protocol-error:${payload.code}`)
                void context.dispatchCommand(
                    createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
                ).catch(() => {})
            }
            return {}
        }),
    ],
)
