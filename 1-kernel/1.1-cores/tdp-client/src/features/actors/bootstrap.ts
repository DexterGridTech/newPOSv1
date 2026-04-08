import {Actor, LOG_TAGS, logger, storeEntry} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTdpClientCommands} from '../commands'
import {
  tdpCommandInboxActions,
  tdpControlSignalsActions,
  tdpProjectionActions,
  tdpSessionActions,
  tdpSyncActions,
} from '../slices'

export class BootstrapActor extends Actor {
  bootstrapTdpClient = Actor.defineCommandHandler(kernelCoreTdpClientCommands.bootstrapTdpClient, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'BootstrapActor'], 'Bootstrapping tdp client...')
    storeEntry.dispatchAction(tdpSessionActions.resetSession())
    storeEntry.dispatchAction(tdpProjectionActions.resetProjection())
    storeEntry.dispatchAction(tdpCommandInboxActions.resetCommandInbox())
    // 只清运行态，不清 lastCursor/lastAppliedRevision，这样重启后还能继续增量恢复。
    storeEntry.dispatchAction(tdpSyncActions.resetRuntimeState())
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastProtocolError(null))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastEdgeDegraded(null))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastRehomeRequired(null))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastDisconnectReason(null))
    kernelCoreTdpClientCommands.bootstrapTdpClientSucceeded(undefined).executeFromParent(command)
    return {}
  })
}
