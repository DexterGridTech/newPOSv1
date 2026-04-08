import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {batchUpdateState, type ModuleSliceConfig} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientState} from '../../types'
import type {TdpSessionState, TdpSessionStatus, TdpServerMessage} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TdpSessionState = {
  status: nowValue<TdpSessionStatus>('IDLE'),
}

const slice = createSlice({
  name: kernelCoreTdpClientState.tdpSession,
  initialState,
  reducers: {
    setStatus(state, action: PayloadAction<TdpSessionStatus>) {
      state.status = nowValue(action.payload)
    },
    setReconnectAttempt(state, action: PayloadAction<number | undefined>) {
      state.reconnectAttempt = action.payload == null ? undefined : nowValue(action.payload)
    },
    setReady(state, action: PayloadAction<Extract<TdpServerMessage, {type: 'SESSION_READY'}>['data']>) {
      state.status = nowValue('READY')
      state.reconnectAttempt = undefined
      state.sessionId = nowValue(action.payload.sessionId)
      state.nodeId = nowValue(action.payload.nodeId)
      state.nodeState = nowValue(action.payload.nodeState)
      state.syncMode = nowValue(action.payload.syncMode)
      state.highWatermark = nowValue(action.payload.highWatermark)
      state.alternativeEndpoints = nowValue(action.payload.alternativeEndpoints)
      state.connectedAt = nowValue(Date.now())
      state.disconnectReason = nowValue(null)
    },
    setLastPongAt(state, action: PayloadAction<number>) {
      state.lastPongAt = nowValue(action.payload)
    },
    setNodeState(state, action: PayloadAction<'healthy' | 'grace' | 'degraded'>) {
      state.nodeState = nowValue(action.payload)
    },
    setHighWatermark(state, action: PayloadAction<number>) {
      state.highWatermark = nowValue(action.payload)
    },
    setAlternativeEndpoints(state, action: PayloadAction<string[]>) {
      state.alternativeEndpoints = nowValue(action.payload)
    },
    setDisconnectReason(state, action: PayloadAction<string | null>) {
      state.disconnectReason = nowValue(action.payload)
    },
    resetSession(state) {
      state.status = nowValue('IDLE')
      state.sessionId = undefined
      state.nodeId = undefined
      state.nodeState = undefined
      state.syncMode = undefined
      state.highWatermark = undefined
      state.connectedAt = undefined
      state.lastPongAt = undefined
      state.alternativeEndpoints = undefined
      state.disconnectReason = undefined
      state.reconnectAttempt = undefined
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tdpSessionActions = slice.actions

export const tdpSessionConfig: ModuleSliceConfig<TdpSessionState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: false,
}
