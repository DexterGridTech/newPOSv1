import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
  batchUpdateState,
  type IAppError,
  type ModuleSliceConfig,
} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientState} from '../../types'
import type {TdpControlSignalsState, TdpServerMessage} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TdpControlSignalsState = {}

const slice = createSlice({
  name: kernelCoreTdpClientState.tdpControlSignals,
  initialState,
  reducers: {
    setLastProtocolError(state, action: PayloadAction<IAppError | null>) {
      state.lastProtocolError = nowValue(action.payload)
    },
    setLastEdgeDegraded(
      state,
      action: PayloadAction<Extract<TdpServerMessage, {type: 'EDGE_DEGRADED'}>['data'] | null>,
    ) {
      state.lastEdgeDegraded = nowValue(action.payload)
    },
    setLastRehomeRequired(
      state,
      action: PayloadAction<Extract<TdpServerMessage, {type: 'SESSION_REHOME_REQUIRED'}>['data'] | null>,
    ) {
      state.lastRehomeRequired = nowValue(action.payload)
    },
    setLastDisconnectReason(state, action: PayloadAction<string | null>) {
      state.lastDisconnectReason = nowValue(action.payload)
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tdpControlSignalsActions = slice.actions

export const tdpControlSignalsConfig: ModuleSliceConfig<TdpControlSignalsState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: false,
}
