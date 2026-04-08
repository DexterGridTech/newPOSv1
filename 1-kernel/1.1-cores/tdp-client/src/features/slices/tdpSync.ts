import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {batchUpdateState, type ModuleSliceConfig} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientState} from '../../types'
import type {TdpSyncState} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TdpSyncState = {
  snapshotStatus: nowValue('idle'),
  changesStatus: nowValue('idle'),
}

const slice = createSlice({
  name: kernelCoreTdpClientState.tdpSync,
  initialState,
  reducers: {
    setSnapshotStatus(state, action: PayloadAction<'idle' | 'loading' | 'ready' | 'error'>) {
      state.snapshotStatus = nowValue(action.payload)
    },
    setChangesStatus(state, action: PayloadAction<'idle' | 'catching-up' | 'ready' | 'error'>) {
      state.changesStatus = nowValue(action.payload)
    },
    setLastCursor(state, action: PayloadAction<number>) {
      state.lastCursor = nowValue(action.payload)
    },
    setLastDeliveredRevision(state, action: PayloadAction<number>) {
      state.lastDeliveredRevision = nowValue(action.payload)
    },
    setLastAckedRevision(state, action: PayloadAction<number>) {
      state.lastAckedRevision = nowValue(action.payload)
    },
    setLastAppliedRevision(state, action: PayloadAction<number>) {
      state.lastAppliedRevision = nowValue(action.payload)
    },
    resetRuntimeState(state) {
      state.snapshotStatus = nowValue('idle')
      state.changesStatus = nowValue('idle')
      state.lastDeliveredRevision = undefined
      state.lastAckedRevision = undefined
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tdpSyncActions = slice.actions

export const tdpSyncConfig: ModuleSliceConfig<TdpSyncState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: true,
  persistBlacklist: [
    'snapshotStatus',
    'changesStatus',
    'lastDeliveredRevision',
    'lastAckedRevision',
  ],
}
