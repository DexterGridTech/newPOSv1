import {createAppError} from '@impos2/kernel-base-contracts'
import {onCommand, type ActorDefinition} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {tdpSyncV2ErrorDefinitions} from '../../supports'
import type {CreateTdpSyncRuntimeModuleV2Input} from '../../types'
import {tdpSyncV2CommandDefinitions} from '../commands'
import {tdpSyncV2StateActions} from '../slices'

export interface TdpSessionConnectionRuntimeV2 {
    startSocketConnection(options?: {isReconnect?: boolean}): Promise<Record<string, unknown>>
    disconnect(reason?: string): void
    sendAck(payload: {cursor: number; topic?: string; itemKey?: string; instanceId?: string}): void
    sendStateReport(payload: {
        cursor: number
        connectionMetrics?: Record<string, unknown>
        localStoreMetrics?: Record<string, unknown>
    }): void
    sendPing(): void
}

export interface TdpSessionConnectionRuntimeRefV2 {
    current?: TdpSessionConnectionRuntimeV2
}

const requireConnectionRuntime = (
    runtimeRef: TdpSessionConnectionRuntimeRefV2,
    commandName: string,
    input: CreateTdpSyncRuntimeModuleV2Input,
) => {
    if (!runtimeRef.current) {
        throw createAppError(tdpSyncV2ErrorDefinitions.assemblyRequired, {
            args: {
                commandName,
            },
            details: {
                hasAssembly: Boolean(input.assembly),
            },
        })
    }
    return runtimeRef.current
}

export const createTdpSessionConnectionActorDefinitionV2 = (
    runtimeRef: TdpSessionConnectionRuntimeRefV2,
    input: CreateTdpSyncRuntimeModuleV2Input,
): ActorDefinition => ({
    moduleName,
    actorName: 'TdpSessionConnectionActor',
    handlers: [
        onCommand(tdpSyncV2CommandDefinitions.connectTdpSession, async () => {
            return await requireConnectionRuntime(
                runtimeRef,
                tdpSyncV2CommandDefinitions.connectTdpSession.commandName,
                input,
            ).startSocketConnection()
        }),
        onCommand(tdpSyncV2CommandDefinitions.disconnectTdpSession, () => {
            requireConnectionRuntime(
                runtimeRef,
                tdpSyncV2CommandDefinitions.disconnectTdpSession.commandName,
                input,
            ).disconnect('command-disconnect')
            return {}
        }),
        onCommand(tdpSyncV2CommandDefinitions.acknowledgeCursor, context => {
            requireConnectionRuntime(
                runtimeRef,
                tdpSyncV2CommandDefinitions.acknowledgeCursor.commandName,
                input,
            ).sendAck(context.command.payload)
            context.dispatchAction(tdpSyncV2StateActions.setLastAckedCursor(context.command.payload.cursor))
            return {cursor: context.command.payload.cursor}
        }),
        onCommand(tdpSyncV2CommandDefinitions.reportAppliedCursor, context => {
            requireConnectionRuntime(
                runtimeRef,
                tdpSyncV2CommandDefinitions.reportAppliedCursor.commandName,
                input,
            ).sendStateReport(context.command.payload)
            context.dispatchAction(tdpSyncV2StateActions.setLastAppliedCursor(context.command.payload.cursor))
            return {cursor: context.command.payload.cursor}
        }),
        onCommand(tdpSyncV2CommandDefinitions.sendPing, () => {
            requireConnectionRuntime(
                runtimeRef,
                tdpSyncV2CommandDefinitions.sendPing.commandName,
                input,
            ).sendPing()
            return {}
        }),
    ],
})
