import type {RootState} from '@impos2/kernel-core-base'
import type {
  TdpCommandInboxState,
  TdpControlSignalsState,
  TdpProjectionState,
  TdpSessionState,
  TdpSyncState,
} from '../types'
import {kernelCoreTdpClientState} from '../types'

export const selectTdpSessionState = (state: RootState): TdpSessionState =>
  state[kernelCoreTdpClientState.tdpSession as keyof RootState] as TdpSessionState

export const selectTdpSyncState = (state: RootState): TdpSyncState =>
  state[kernelCoreTdpClientState.tdpSync as keyof RootState] as TdpSyncState

export const selectTdpProjectionState = (state: RootState): TdpProjectionState =>
  state[kernelCoreTdpClientState.tdpProjection as keyof RootState] as TdpProjectionState

export const selectTdpCommandInboxState = (state: RootState): TdpCommandInboxState =>
  state[kernelCoreTdpClientState.tdpCommandInbox as keyof RootState] as TdpCommandInboxState

export const selectTdpControlSignalsState = (state: RootState): TdpControlSignalsState =>
  state[kernelCoreTdpClientState.tdpControlSignals as keyof RootState] as TdpControlSignalsState
