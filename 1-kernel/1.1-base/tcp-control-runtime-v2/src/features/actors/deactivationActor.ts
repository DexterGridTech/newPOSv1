import {createAppError} from '@impos2/kernel-base-contracts'
import {
    createCommand,
    createModuleActorFactory,
    onCommand,
    type ActorDefinition,
} from '@impos2/kernel-base-runtime-shell-v2'
import {moduleName} from '../../moduleName'
import {selectTcpIdentitySnapshot, selectTcpSandboxId} from '../../selectors'
import {tcpControlV2ErrorDefinitions} from '../../supports'
import {tcpControlV2CommandDefinitions} from '../commands'
import {tcpControlV2StateActions} from '../slices'
import {requireTcpControlHttpService, type TcpControlServiceRefV2} from './serviceRef'

const defineActor = createModuleActorFactory(moduleName)

export const createTcpDeactivationActorDefinitionV2 = (
    serviceRef: TcpControlServiceRefV2,
): ActorDefinition => defineActor('TcpDeactivationActor', [
    onCommand(tcpControlV2CommandDefinitions.deactivateTerminal, async actorContext => {
        const httpService = requireTcpControlHttpService(serviceRef)
        const identity = selectTcpIdentitySnapshot(actorContext.getState())
        const sandboxId = selectTcpSandboxId(actorContext.getState())
        const terminalId = identity.terminalId

        if (!sandboxId || !terminalId) {
            const appError = createAppError(
                tcpControlV2ErrorDefinitions.deactivationFailed,
                {
                    args: {error: !sandboxId ? 'sandboxId is missing' : 'terminal id is missing'},
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

        try {
            const result = await httpService.deactivateTerminal(terminalId, {
                sandboxId,
                reason: actorContext.command.payload.reason,
            })
            await actorContext.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.deactivateTerminalSucceeded,
                {terminalId: result.terminalId},
            ))
            await actorContext.dispatchCommand(createCommand(
                tcpControlV2CommandDefinitions.resetTcpControl,
                {},
            ))
            actorContext.requestApplicationReset?.({
                reason: `${moduleName}.deactivateTerminal`,
            })
            return {
                terminalId: result.terminalId,
                status: result.status,
            }
        } catch (error) {
            actorContext.dispatchAction(tcpControlV2StateActions.setLastError(error as any))
            throw error
        }
    }),
])
