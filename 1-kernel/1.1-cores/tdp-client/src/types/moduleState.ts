import {kernelCoreTdpClientState} from './shared'
import type {
  TdpCommandInboxState,
  TdpControlSignalsState,
  TdpProjectionState,
  TdpSessionState,
  TdpSyncState,
} from './state'

export interface KernelCoreTdpClientState {
  [kernelCoreTdpClientState.tdpSession]: TdpSessionState
  [kernelCoreTdpClientState.tdpSync]: TdpSyncState
  [kernelCoreTdpClientState.tdpProjection]: TdpProjectionState
  [kernelCoreTdpClientState.tdpCommandInbox]: TdpCommandInboxState
  [kernelCoreTdpClientState.tdpControlSignals]: TdpControlSignalsState
}
