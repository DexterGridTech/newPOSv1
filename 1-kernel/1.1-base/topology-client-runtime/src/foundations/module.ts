import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {ErrorDefinition} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {topologyClientCommandNames} from '../features/commands'
import {topologyClientStateActions, topologyClientStateSlices} from '../features/slices'
import {createTopologyClientContext} from './context'
import {createTopologyClientOrchestrator} from './orchestrator'
import {moduleName} from '../moduleName'
import {packageVersion} from '../generated/packageVersion'
import type {
    CreateTopologyClientRuntimeModuleInput,
    DispatchRemoteCommandInput,
    SetTopologyDisplayModeInput,
    SetTopologyEnableSlaveInput,
    SetTopologyInstanceModeInput,
    SetTopologyMasterInfoInput,
} from '../types'

const TOPOLOGY_CLIENT_SESSION_UNAVAILABLE_ERROR: ErrorDefinition = {
    key: 'kernel.base.topology-client-runtime.session_unavailable',
    name: 'Topology Client Session Unavailable',
    defaultTemplate: 'Topology client session is not available for remote command ${commandName}',
    category: 'NETWORK',
    severity: 'HIGH',
    moduleName,
}

const TOPOLOGY_CLIENT_ASSEMBLY_REQUIRED_ERROR: ErrorDefinition = {
    key: 'kernel.base.topology-client-runtime.assembly_required',
    name: 'Topology Client Assembly Required',
    defaultTemplate: 'Topology client assembly is required for command ${commandName}',
    category: 'SYSTEM',
    severity: 'HIGH',
    moduleName,
}

export const createTopologyClientRuntimeModule = (
    input: CreateTopologyClientRuntimeModuleInput = {},
): KernelRuntimeModule => {
    return {
        moduleName,
        packageVersion,
        stateSlices: topologyClientStateSlices,
        commands: [
            {
                name: topologyClientCommandNames.setInstanceMode,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.setDisplayMode,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.setEnableSlave,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.setMasterInfo,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.clearMasterInfo,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.refreshTopologyContext,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.startTopologyConnection,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.stopTopologyConnection,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.restartTopologyConnection,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.resumeTopologySession,
                visibility: 'public',
            },
            {
                name: topologyClientCommandNames.dispatchRemoteCommand,
                visibility: 'public',
            },
        ],
        errorDefinitions: [
            TOPOLOGY_CLIENT_SESSION_UNAVAILABLE_ERROR,
            TOPOLOGY_CLIENT_ASSEMBLY_REQUIRED_ERROR,
        ],
        install(context) {
            const syncTopologyContext = () => {
                const topologyContext = createTopologyClientContext({
                    localNodeId: context.localNodeId,
                    topology: context.topology,
                    updatedAt: nowTimestampMs(),
                })

                context.dispatchAction(topologyClientStateActions.replaceTopologyClientContext(topologyContext))
            }

            context.topology.subscribeRecoveryState(() => {
                syncTopologyContext()
            })

            context.registerHandler(
                topologyClientCommandNames.setInstanceMode,
                async handlerContext => {
                    const payload = handlerContext.command.payload as SetTopologyInstanceModeInput
                    context.topology.updateRecoveryState({
                        instanceMode: payload.instanceMode,
                    })
                },
            )

            context.registerHandler(
                topologyClientCommandNames.setDisplayMode,
                async handlerContext => {
                    const payload = handlerContext.command.payload as SetTopologyDisplayModeInput
                    context.topology.updateRecoveryState({
                        displayMode: payload.displayMode,
                    })
                },
            )

            context.registerHandler(
                topologyClientCommandNames.setEnableSlave,
                async handlerContext => {
                    const payload = handlerContext.command.payload as SetTopologyEnableSlaveInput
                    context.topology.updateRecoveryState({
                        enableSlave: payload.enableSlave,
                    })
                },
            )

            context.registerHandler(
                topologyClientCommandNames.setMasterInfo,
                async handlerContext => {
                    const payload = handlerContext.command.payload as SetTopologyMasterInfoInput
                    context.topology.updateRecoveryState({
                        masterInfo: payload.masterInfo,
                    })
                },
            )

            context.registerHandler(
                topologyClientCommandNames.clearMasterInfo,
                async () => {
                    context.topology.updateRecoveryState({
                        masterInfo: null,
                    })
                },
            )

            context.registerHandler(
                topologyClientCommandNames.refreshTopologyContext,
                async () => {
                    syncTopologyContext()
                    return {
                        context: createTopologyClientContext({
                            localNodeId: context.localNodeId,
                            topology: context.topology,
                            updatedAt: nowTimestampMs(),
                        }),
                    }
                },
            )

            if (!input.assembly) {
                const registerAssemblyRequiredHandler = (commandName: string) => {
                    context.registerHandler(
                        commandName,
                        async handlerContext => {
                            throw createAppError(TOPOLOGY_CLIENT_ASSEMBLY_REQUIRED_ERROR, {
                                args: {commandName: handlerContext.command.commandName},
                                context: {
                                    commandName: handlerContext.command.commandName,
                                    commandId: handlerContext.command.commandId,
                                    requestId: handlerContext.command.requestId,
                                    sessionId: handlerContext.command.sessionId,
                                    nodeId: context.localNodeId as any,
                                },
                            })
                        },
                    )
                }

                registerAssemblyRequiredHandler(topologyClientCommandNames.startTopologyConnection)
                registerAssemblyRequiredHandler(topologyClientCommandNames.stopTopologyConnection)
                registerAssemblyRequiredHandler(topologyClientCommandNames.restartTopologyConnection)
                registerAssemblyRequiredHandler(topologyClientCommandNames.resumeTopologySession)
                context.registerHandler(
                    topologyClientCommandNames.dispatchRemoteCommand,
                    async handlerContext => {
                        throw createAppError(TOPOLOGY_CLIENT_ASSEMBLY_REQUIRED_ERROR, {
                            args: {commandName: handlerContext.command.commandName},
                            context: {
                                commandName: handlerContext.command.commandName,
                                commandId: handlerContext.command.commandId,
                                requestId: handlerContext.command.requestId,
                                sessionId: handlerContext.command.sessionId,
                                nodeId: context.localNodeId as any,
                            },
                        })
                    },
                )
                return
            }

            const orchestrator = createTopologyClientOrchestrator({
                context,
                assembly: input.assembly,
            })

            context.registerHandler(
                topologyClientCommandNames.startTopologyConnection,
                async () => {
                    await orchestrator.startConnection()
                },
            )

            context.registerHandler(
                topologyClientCommandNames.stopTopologyConnection,
                async () => {
                    orchestrator.stopConnection('command-stop')
                },
            )

            context.registerHandler(
                topologyClientCommandNames.restartTopologyConnection,
                async () => {
                    await orchestrator.restartConnection('command-restart')
                },
            )

            context.registerHandler(
                topologyClientCommandNames.resumeTopologySession,
                async () => {
                    orchestrator.beginResume()
                },
            )

            context.registerHandler(
                topologyClientCommandNames.dispatchRemoteCommand,
                async handlerContext => {
                    const payload = handlerContext.command.payload as DispatchRemoteCommandInput
                    const sessionId = orchestrator.getSessionContext().sessionId
                    if (!sessionId) {
                        throw createAppError(TOPOLOGY_CLIENT_SESSION_UNAVAILABLE_ERROR, {
                            args: {commandName: payload.commandName},
                            context: {
                                commandName: handlerContext.command.commandName,
                                commandId: handlerContext.command.commandId,
                                requestId: handlerContext.command.requestId,
                                sessionId: handlerContext.command.sessionId,
                                nodeId: context.localNodeId as any,
                            },
                        })
                    }

                    return orchestrator.dispatchRemoteCommand(payload)
                },
            )

            const recoveryState = context.topology.getRecoveryState()
            const shouldConnect = recoveryState.instanceMode === 'SLAVE'
                ? Boolean(recoveryState.masterInfo)
                : recoveryState.enableSlave === true

            if (!shouldConnect) {
                return
            }

            void orchestrator.startConnection()
        },
    }
}
