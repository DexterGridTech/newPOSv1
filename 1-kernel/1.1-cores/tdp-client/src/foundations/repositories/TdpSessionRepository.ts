import {storeEntry} from '@impos2/kernel-core-base'
import {selectTdpSessionState, selectTdpSyncState} from '../../selectors'

export class TdpSessionRepository {
  getLastCursor(): number {
    return selectTdpSyncState(storeEntry.getState())?.lastCursor?.value ?? 0
  }

  getLastAppliedRevision(): number {
    return selectTdpSyncState(storeEntry.getState())?.lastAppliedRevision?.value ?? 0
  }
}

export const tdpSessionRepository = new TdpSessionRepository()
