import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ModuleSliceConfig, DeviceInfo} from '@impos2/kernel-core-base'
import {batchUpdateState} from '@impos2/kernel-core-base'
import {kernelCoreTcpClientState} from '../../types'
import type {TcpIdentityState, TcpActivationStatus} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TcpIdentityState = {
  activationStatus: nowValue<TcpActivationStatus>('UNACTIVATED'),
}

const slice = createSlice({
  name: kernelCoreTcpClientState.tcpIdentity,
  initialState,
  reducers: {
    setDeviceFingerprint(state, action: PayloadAction<string>) {
      state.deviceFingerprint = nowValue(action.payload)
    },
    setDeviceInfo(state, action: PayloadAction<DeviceInfo>) {
      state.deviceInfo = nowValue(action.payload)
    },
    setActivationStatus(state, action: PayloadAction<TcpActivationStatus>) {
      state.activationStatus = nowValue(action.payload)
    },
    setActivatedIdentity(state, action: PayloadAction<{terminalId: string; activatedAt: number}>) {
      state.terminalId = nowValue(action.payload.terminalId)
      state.activatedAt = nowValue(action.payload.activatedAt)
      state.activationStatus = nowValue('ACTIVATED')
    },
    resetIdentity(state) {
      state.deviceFingerprint = undefined
      state.deviceInfo = undefined
      state.terminalId = undefined
      state.activatedAt = undefined
      state.activationStatus = nowValue('UNACTIVATED')
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tcpIdentityActions = slice.actions

export const tcpIdentityConfig: ModuleSliceConfig<TcpIdentityState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: true,
}
