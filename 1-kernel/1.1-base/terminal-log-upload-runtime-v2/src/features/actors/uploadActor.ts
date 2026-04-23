import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorExecutionContext,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTcpSandboxId,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {selectTopologyRuntimeV3Context} from '@impos2/kernel-base-topology-runtime-v3'
import {moduleName} from '../../moduleName'
import {terminalLogUploadRuntimeV2ErrorDefinitions} from '../../supports/errors'
import {terminalLogUploadRuntimeV2CommandDefinitions} from '../commands'

const defineActor = createModuleActorFactory(moduleName)

const isPrimaryMaster = (state: ReturnType<ActorExecutionContext['getState']>) => {
    const topology = selectTopologyRuntimeV3Context(state)
    if (!topology) {
        return false
    }
    return topology.instanceMode === 'MASTER' && topology.displayMode === 'PRIMARY'
}

const resolveLogDisplayIdentity = (actorContext: ActorExecutionContext) => {
    const topology = selectTopologyRuntimeV3Context(actorContext.getState())
    const displayIndex = actorContext.displayContext.displayIndex ?? topology?.displayIndex ?? 0
    const displayRole = topology?.instanceMode === 'SLAVE'
        ? 'SLAVE'
        : topology?.instanceMode === 'MASTER'
            ? 'MASTER'
            : topology?.displayMode === 'SECONDARY'
                ? 'SECONDARY'
                : 'PRIMARY'
    return {
        displayIndex,
        displayRole,
        topology,
    }
}

const uploadCurrentDisplayLogs = async (
    actorContext: ActorExecutionContext,
    input: {
        logDate: string
        uploadUrl: string
        overwrite?: boolean
        headers?: Record<string, string>
        metadata?: Record<string, unknown>
        commandId?: string
        instanceId?: string
        releaseId?: string | null
    },
) => {
    const terminalLogs = actorContext.platformPorts.terminalLogs
    if (!terminalLogs) {
        throw createAppError(terminalLogUploadRuntimeV2ErrorDefinitions.terminalLogPortMissing, {
            context: {
                commandName: actorContext.command.commandName,
                commandId: actorContext.command.commandId,
                requestId: actorContext.command.requestId,
                nodeId: actorContext.localNodeId,
            },
        })
    }

    const sandboxId = selectTcpSandboxId(actorContext.getState())
    const terminalId = selectTcpTerminalId(actorContext.getState())
    if (!terminalId) {
        throw createAppError(terminalLogUploadRuntimeV2ErrorDefinitions.terminalNotActivated, {
            context: {
                commandName: actorContext.command.commandName,
                commandId: actorContext.command.commandId,
                requestId: actorContext.command.requestId,
                nodeId: actorContext.localNodeId,
            },
        })
    }

    const {displayIndex, displayRole, topology} = resolveLogDisplayIdentity(actorContext)
    return await terminalLogs.uploadLogsForDate({
        uploadUrl: input.uploadUrl,
        logDate: input.logDate,
        terminalId,
        sandboxId,
        commandId: input.commandId ?? actorContext.command.commandId,
        instanceId: input.instanceId,
        releaseId: input.releaseId ?? undefined,
        displayIndex,
        displayRole,
        overwrite: input.overwrite,
        headers: input.headers,
        metadata: {
            ...(input.metadata ?? {}),
            localNodeId: actorContext.localNodeId,
            topologyInstanceMode: topology?.instanceMode,
            topologyDisplayMode: topology?.displayMode,
        },
    })
}

export const createTerminalLogUploadActorDefinitionV2 = (): ActorDefinition => defineActor(
    'TerminalLogUploadActor',
    [
        onCommand(terminalLogUploadRuntimeV2CommandDefinitions.uploadTerminalLogs, async actorContext => {
            const payload = actorContext.command.payload
            const localResult = await uploadCurrentDisplayLogs(actorContext, {
                logDate: payload.logDate,
                uploadUrl: payload.uploadUrl,
                overwrite: payload.overwrite,
                headers: payload.headers,
                metadata: payload.metadata,
                commandId: payload.commandId,
                instanceId: payload.instanceId,
                releaseId: payload.releaseId ?? payload.sourceReleaseId,
            })

            let peerResult: Record<string, unknown> | undefined
            if (isPrimaryMaster(actorContext.getState())) {
                const dispatched = await actorContext.dispatchCommand(
                    createCommand(
                        terminalLogUploadRuntimeV2CommandDefinitions.uploadPeerTerminalLogs,
                        {
                            ...payload,
                            initiatedBy: 'master',
                        },
                    ),
                    {
                        target: 'peer',
                    },
                )
                peerResult = {
                    status: dispatched.status,
                    actorResults: dispatched.actorResults,
                }
            }

            if (payload.instanceId) {
                await actorContext.dispatchCommand(createCommand(
                    tcpControlV2CommandDefinitions.reportTaskResult,
                    {
                        instanceId: payload.instanceId,
                        status: peerResult && peerResult.status !== 'COMPLETED' ? 'FAILED' : 'COMPLETED',
                        result: {
                            requestedDate: payload.logDate,
                            local: localResult,
                            peer: peerResult ?? null,
                        },
                        error: peerResult && peerResult.status !== 'COMPLETED'
                            ? {
                                message: 'peer terminal log upload failed',
                                detail: peerResult,
                            }
                            : undefined,
                    },
                ))
            }

            return {
                local: localResult,
                peer: peerResult ?? null,
            }
        }),
        onCommand(terminalLogUploadRuntimeV2CommandDefinitions.uploadPeerTerminalLogs, async actorContext => {
            const payload = actorContext.command.payload
            const localResult = await uploadCurrentDisplayLogs(actorContext, {
                logDate: payload.logDate,
                uploadUrl: payload.uploadUrl,
                overwrite: payload.overwrite,
                headers: payload.headers,
                metadata: payload.metadata,
                commandId: payload.commandId,
                instanceId: payload.instanceId,
                releaseId: payload.releaseId ?? payload.sourceReleaseId,
            })
            return {
                local: localResult,
                initiatedBy: payload.initiatedBy,
            }
        }),
    ],
)
