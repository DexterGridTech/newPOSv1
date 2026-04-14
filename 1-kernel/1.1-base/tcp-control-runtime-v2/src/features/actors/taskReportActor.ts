import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTcpTerminalId} from '../../selectors'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'
import {requireTcpControlHttpService, type TcpControlServiceRefV2} from './serviceRef'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpTaskReportActorDefinitionV2 = (
    serviceRef: TcpControlServiceRefV2,
): ActorDefinition => defineActor('TcpTaskReportActor', [
    onCommand(tcpControlV2CommandDefinitions.reportTaskResult, async actorContext => {
            const httpService = requireTcpControlHttpService(serviceRef)
            const terminalId = actorContext.command.payload.terminalId
                ?? selectTcpTerminalId(actorContext.getState())
            if (!terminalId) {
                const appError = createAppError(
                    tcpControlV2ErrorDefinitions.bootstrapHydrationFailed,
                    {
                        args: {error: 'terminalId is missing'},
                        context: {
                            commandName: actorContext.command.commandName,
                            commandId: actorContext.command.commandId,
                            requestId: actorContext.command.requestId,
                            nodeId: actorContext.localNodeId,
                        },
                    },
                )
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(appError))
                throw appError
            }

            actorContext.dispatchAction(
                tcpControlV2StateActions.setLastTaskReportRequestId(actorContext.command.requestId),
            )

            try {
                const result = await httpService.reportTaskResult(
                    terminalId,
                    actorContext.command.payload.instanceId,
                    {
                        status: actorContext.command.payload.status,
                        result: actorContext.command.payload.result,
                        error: actorContext.command.payload.error,
                    },
                )
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(null))

                await actorContext.dispatchCommand(
                    createCommand(
                        tcpControlV2CommandDefinitions.taskResultReported,
                        {
                            instanceId: result.instanceId,
                            status: result.status,
                        },
                    ),
                )

                return {
                    instanceId: result.instanceId,
                    status: result.status,
                    finishedAt: result.finishedAt,
                }
            } catch (error) {
                actorContext.dispatchAction(tcpControlV2StateActions.setLastError(error as any))
                throw error
            }
        }),
])
