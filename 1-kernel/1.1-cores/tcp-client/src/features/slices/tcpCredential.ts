import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ModuleSliceConfig} from '@impos2/kernel-core-base'
import {batchUpdateState} from '@impos2/kernel-core-base'
import {kernelCoreTcpClientState} from '../../types'
import type {TcpCredentialState, TcpCredentialStatus} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TcpCredentialState = {
  status: nowValue<TcpCredentialStatus>('EMPTY'),
}

const slice = createSlice({
  name: kernelCoreTcpClientState.tcpCredential,
  initialState,
  reducers: {
    setCredentialStatus(state, action: PayloadAction<TcpCredentialStatus>) {
      state.status = nowValue(action.payload)
    },
    setCredential(
      state,
      action: PayloadAction<{
        accessToken: string
        refreshToken?: string
        expiresAt: number
        refreshExpiresAt?: number
      }>,
    ) {
      state.accessToken = nowValue(action.payload.accessToken)
      if (action.payload.refreshToken) {
        state.refreshToken = nowValue(action.payload.refreshToken)
      }
      state.expiresAt = nowValue(action.payload.expiresAt)
      if (action.payload.refreshExpiresAt) {
        state.refreshExpiresAt = nowValue(action.payload.refreshExpiresAt)
      }
      state.updatedAt = nowValue(Date.now())
      state.status = nowValue('READY')
    },
    resetCredential(state) {
      state.accessToken = undefined
      state.refreshToken = undefined
      state.expiresAt = undefined
      state.refreshExpiresAt = undefined
      state.updatedAt = undefined
      state.status = nowValue('EMPTY')
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tcpCredentialActions = slice.actions

export const tcpCredentialConfig: ModuleSliceConfig<TcpCredentialState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: true,
}
