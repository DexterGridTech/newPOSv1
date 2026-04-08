import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ModuleSliceConfig} from '@impos2/kernel-core-base'
import {batchUpdateState} from '@impos2/kernel-core-base'
import {kernelCoreTcpClientState} from '../../types'
import type {TcpBindingContext, TcpBindingState} from '../../types'

const nowValue = <T>(value: T) => ({value, updatedAt: Date.now()})

const initialState: TcpBindingState = {}

const slice = createSlice({
  name: kernelCoreTcpClientState.tcpBinding,
  initialState,
  reducers: {
    setBinding(state, action: PayloadAction<TcpBindingContext>) {
      const binding = action.payload
      state.platformId = binding.platformId ? nowValue(binding.platformId) : undefined
      state.tenantId = binding.tenantId ? nowValue(binding.tenantId) : undefined
      state.brandId = binding.brandId ? nowValue(binding.brandId) : undefined
      state.projectId = binding.projectId ? nowValue(binding.projectId) : undefined
      state.storeId = binding.storeId ? nowValue(binding.storeId) : undefined
      state.profileId = binding.profileId ? nowValue(binding.profileId) : undefined
      state.templateId = binding.templateId ? nowValue(binding.templateId) : undefined
    },
    resetBinding(state) {
      state.platformId = undefined
      state.tenantId = undefined
      state.brandId = undefined
      state.projectId = undefined
      state.storeId = undefined
      state.profileId = undefined
      state.templateId = undefined
    },
    batchUpdateState(state, action) {
      batchUpdateState(state, action)
    },
  },
})

export const tcpBindingActions = slice.actions

export const tcpBindingConfig: ModuleSliceConfig<TcpBindingState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: true,
}
