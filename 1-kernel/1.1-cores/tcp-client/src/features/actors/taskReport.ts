import {Actor, AppError, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTcpClientCommands} from '../commands'
import {tcpIdentityRepository, tcpTaskReportCoordinator} from '../../foundations'
import {tcpRuntimeActions} from '../slices'
import {kernelCoreTcpClientErrorMessages} from '../../supports'

export class TaskReportActor extends Actor {
  reportTaskResult = Actor.defineCommandHandler(kernelCoreTcpClientCommands.reportTaskResult, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'TaskReportActor'], 'Reporting task result...', command.payload)
    const terminalId = command.payload.terminalId || tcpIdentityRepository.getTerminalId()
    if (!terminalId) {
      throw new AppError(kernelCoreTcpClientErrorMessages.tcpBootstrapHydrationFailed, {
        error: 'terminalId is missing',
      }, command)
    }

    storeEntry.dispatchAction(tcpRuntimeActions.setLastTaskReportRequestId(command.id))
    const result = await tcpTaskReportCoordinator.report({
      ...command.payload,
      terminalId,
    })
    storeEntry.dispatchAction(tcpRuntimeActions.setLastError(null))
    kernelCoreTcpClientCommands.taskResultReported({
      instanceId: result.instanceId,
      status: result.status,
    }).executeFromParent(command)
    return result as Record<string, any>
  })
}
