import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {IAppError, ModuleSliceConfig} from '@impos2/kernel-core-base'
import {batchUpdateState} from '@impos2/kernel-core-base'
import {kernelCoreTcpClientState} from '../../types'
import type {TcpRuntimeState} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TcpRuntimeState = {
  bootstrapped: nowValue(false),
}

const slice = createSlice({
  name: kernelCoreTcpClientState.tcpRuntime,
  initialState,
  reducers: {
    setBootstrapped(state, action: PayloadAction<boolean>) {
      state.bootstrapped = nowValue(action.payload)
    },
    setLastActivationRequestId(state, action: PayloadAction<string>) {
      state.lastActivationRequestId = nowValue(action.payload)
    },
    setLastRefreshRequestId(state, action: PayloadAction<string>) {
      state.lastRefreshRequestId = nowValue(action.payload)
    },
    setLastTaskReportRequestId(state, action: PayloadAction<string>) {
      state.lastTaskReportRequestId = nowValue(action.payload)
    },
    setLastError(state, action: PayloadAction<IAppError | null>) {
      state.lastError = nowValue(action.payload)
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tcpRuntimeActions = slice.actions

export const tcpRuntimeConfig: ModuleSliceConfig<TcpRuntimeState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: false,
}
