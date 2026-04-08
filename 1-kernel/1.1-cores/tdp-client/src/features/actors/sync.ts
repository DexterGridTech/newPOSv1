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
import {selectTdpSyncState} from '../../selectors'

export class SyncActor extends Actor {
  tdpSessionReady = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSessionReady, async command => {
    logger.log([moduleName, LOG_TAGS.Actor, 'SyncActor'], 'TDP session ready', command.payload)
    storeEntry.dispatchAction(tdpSessionActions.setReady(command.payload))
    return {sessionId: command.payload.sessionId}
  })

  tdpSnapshotLoaded = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSnapshotLoaded, async command => {
    storeEntry.dispatchAction(tdpProjectionActions.replaceSnapshot(command.payload.snapshot))
    storeEntry.dispatchAction(tdpSyncActions.setSnapshotStatus('ready'))
    storeEntry.dispatchAction(tdpSyncActions.setChangesStatus('ready'))
    storeEntry.dispatchAction(tdpSyncActions.setLastCursor(command.payload.highWatermark))
    storeEntry.dispatchAction(tdpSessionActions.setHighWatermark(command.payload.highWatermark))
    storeEntry.dispatchAction(tdpSyncActions.setLastDeliveredRevision(command.payload.highWatermark))
    storeEntry.dispatchAction(tdpSyncActions.setLastAckedRevision(command.payload.highWatermark))
    storeEntry.dispatchAction(tdpSyncActions.setLastAppliedRevision(command.payload.highWatermark))
    if (command.payload.highWatermark > 0) {
      kernelCoreTdpClientCommands.acknowledgeCursor({
        cursor: command.payload.highWatermark,
      }).executeFromParent(command)
      kernelCoreTdpClientCommands.reportAppliedCursor({
        cursor: command.payload.highWatermark,
      }).executeFromParent(command)
    }
    return {highWatermark: command.payload.highWatermark}
  })

  tdpChangesLoaded = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpChangesLoaded, async command => {
    storeEntry.dispatchAction(tdpSyncActions.setChangesStatus('catching-up'))
    command.payload.changes.forEach(change => {
      storeEntry.dispatchAction(tdpProjectionActions.applyProjection(change))
    })
    storeEntry.dispatchAction(tdpSyncActions.setLastCursor(command.payload.nextCursor))
    storeEntry.dispatchAction(tdpSessionActions.setHighWatermark(command.payload.highWatermark))
    storeEntry.dispatchAction(tdpSyncActions.setLastDeliveredRevision(command.payload.nextCursor))
    storeEntry.dispatchAction(tdpSyncActions.setLastAckedRevision(command.payload.nextCursor))
    storeEntry.dispatchAction(tdpSyncActions.setLastAppliedRevision(command.payload.nextCursor))
    storeEntry.dispatchAction(tdpSyncActions.setChangesStatus(command.payload.hasMore ? 'catching-up' : 'ready'))
    if (command.payload.nextCursor > 0) {
      kernelCoreTdpClientCommands.acknowledgeCursor({
        cursor: command.payload.nextCursor,
      }).executeFromParent(command)
      kernelCoreTdpClientCommands.reportAppliedCursor({
        cursor: command.payload.nextCursor,
      }).executeFromParent(command)
    }
    return {nextCursor: command.payload.nextCursor}
  })

  tdpProjectionReceived = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpProjectionReceived, async command => {
    const revision = command.payload.change.revision
    const cursor = command.payload.cursor
    storeEntry.dispatchAction(tdpProjectionActions.applyProjection(command.payload.change))
    storeEntry.dispatchAction(tdpSyncActions.setLastCursor(cursor))
    storeEntry.dispatchAction(tdpSessionActions.setHighWatermark(cursor))
    storeEntry.dispatchAction(tdpSyncActions.setLastDeliveredRevision(cursor))
    storeEntry.dispatchAction(tdpSyncActions.setLastAppliedRevision(cursor))
    kernelCoreTdpClientCommands.acknowledgeCursor({
      cursor,
      topic: command.payload.change.topic,
      itemKey: command.payload.change.itemKey,
    }).executeFromParent(command)
    kernelCoreTdpClientCommands.reportAppliedCursor({
      cursor,
    }).executeFromParent(command)
    return {revision}
  })

  tdpProjectionBatchReceived = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpProjectionBatchReceived, async command => {
    let maxRevision = 0
    command.payload.changes.forEach(change => {
      storeEntry.dispatchAction(tdpProjectionActions.applyProjection(change))
      maxRevision = Math.max(maxRevision, change.revision)
    })
    if (command.payload.nextCursor > 0) {
      storeEntry.dispatchAction(tdpSyncActions.setLastCursor(command.payload.nextCursor))
      storeEntry.dispatchAction(tdpSessionActions.setHighWatermark(command.payload.nextCursor))
      storeEntry.dispatchAction(tdpSyncActions.setLastDeliveredRevision(command.payload.nextCursor))
      storeEntry.dispatchAction(tdpSyncActions.setLastAppliedRevision(command.payload.nextCursor))
      kernelCoreTdpClientCommands.acknowledgeCursor({
        cursor: command.payload.nextCursor,
      }).executeFromParent(command)
      kernelCoreTdpClientCommands.reportAppliedCursor({
        cursor: command.payload.nextCursor,
      }).executeFromParent(command)
    }
    return {revision: maxRevision}
  })

  tdpCommandDelivered = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpCommandDelivered, async command => {
    storeEntry.dispatchAction(tdpCommandInboxActions.pushCommand(command.payload))
    const resolvedCursor = selectTdpSyncState(storeEntry.getState())?.lastCursor?.value ?? 0
    if (resolvedCursor > 0) {
      storeEntry.dispatchAction(tdpSyncActions.setLastAckedRevision(resolvedCursor))
    }
    kernelCoreTdpClientCommands.acknowledgeCursor({
      cursor: resolvedCursor,
      topic: command.payload.topic,
      itemKey: command.payload.commandId,
      instanceId: typeof command.payload.payload.instanceId === 'string'
        ? command.payload.payload.instanceId
        : undefined,
    }).executeFromParent(command)
    return {commandId: command.payload.commandId}
  })

  tdpPongReceived = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpPongReceived, async command => {
    storeEntry.dispatchAction(tdpSessionActions.setLastPongAt(command.payload.timestamp))
    return command.payload
  })

  tdpEdgeDegraded = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpEdgeDegraded, async command => {
    storeEntry.dispatchAction(tdpSessionActions.setStatus('DEGRADED'))
    storeEntry.dispatchAction(tdpSessionActions.setNodeState(command.payload.nodeState))
    storeEntry.dispatchAction(tdpSessionActions.setAlternativeEndpoints(command.payload.alternativeEndpoints))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastEdgeDegraded(command.payload))
    return {nodeState: command.payload.nodeState}
  })

  tdpSessionRehomeRequired = Actor.defineCommandHandler(kernelCoreTdpClientCommands.tdpSessionRehomeRequired, async command => {
    storeEntry.dispatchAction(tdpSessionActions.setStatus('REHOME_REQUIRED'))
    storeEntry.dispatchAction(tdpSessionActions.setAlternativeEndpoints(command.payload.alternativeEndpoints))
    storeEntry.dispatchAction(tdpControlSignalsActions.setLastRehomeRequired(command.payload))
    return {deadline: command.payload.deadline}
  })
}
