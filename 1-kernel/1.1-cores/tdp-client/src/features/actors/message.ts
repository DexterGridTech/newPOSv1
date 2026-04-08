import {
  Actor,
  AppError,
  LOG_TAGS,
  logger,
  storeEntry,
} from '@impos2/kernel-core-base'
import {moduleName} from '../../moduleName'
import {kernelCoreTdpClientCommands} from '../commands'
import {
  tdpControlSignalsActions,
  tdpSessionActions,
} from '../slices'
import {kernelCoreTdpClientErrorMessages} from '../../supports'

export class MessageActor extends Actor {
  tdpMessageReceived = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpMessageReceived, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'MessageActor'], 'Handling tdp message...', command.payload.type)
    const message = command.payload

    if (message.type === 'SESSION_READY') {
      kernelCoreTdpClientCommands.tdpSessionReady(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'FULL_SNAPSHOT') {
      kernelCoreTdpClientCommands.tdpSnapshotLoaded({
        snapshot: message.data.snapshot,
        highWatermark: message.data.highWatermark,
      }).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'CHANGESET') {
      kernelCoreTdpClientCommands.tdpChangesLoaded({
        changes: message.data.changes,
        nextCursor: message.data.nextCursor,
        hasMore: message.data.hasMore,
        highWatermark: message.data.highWatermark,
      }).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'PROJECTION_CHANGED') {
      kernelCoreTdpClientCommands.tdpProjectionReceived(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'PROJECTION_BATCH') {
      kernelCoreTdpClientCommands.tdpProjectionBatchReceived(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'COMMAND_DELIVERED') {
      kernelCoreTdpClientCommands.tdpCommandDelivered(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'PONG') {
      kernelCoreTdpClientCommands.tdpPongReceived({timestamp: message.data.timestamp}).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'EDGE_DEGRADED') {
      kernelCoreTdpClientCommands.tdpEdgeDegraded(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'SESSION_REHOME_REQUIRED') {
      kernelCoreTdpClientCommands.tdpSessionRehomeRequired(message.data).executeFromParent(command)
      return {type: message.type}
    }
    if (message.type === 'ERROR') {
      const appError = new AppError(
        kernelCoreTdpClientErrorMessages.tdpProtocolError,
        {error: `${message.error.code}:${message.error.message}`},
        command,
      )
      storeEntry.dispatchAction(tdpSessionActions.setStatus('ERROR'))
      storeEntry.dispatchAction(tdpControlSignalsActions.setLastProtocolError(appError))
      kernelCoreTdpClientCommands.tdpProtocolFailed({error: appError}).executeFromParent(command)
      return {type: message.type}
    }

    return {type: 'IGNORED'}
  })
}
