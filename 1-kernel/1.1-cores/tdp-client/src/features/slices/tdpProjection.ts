import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ModuleSliceConfig} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientState} from '../../types'
import type {TdpProjectionEnvelope, TdpProjectionState} from '../../types'

const initialState: TdpProjectionState = {
  byTopic: {},
}

const slice = createSlice({
  name: kernelCoreTdpClientState.tdpProjection,
  initialState,
  reducers: {
    applyProjection(state, action: PayloadAction<TdpProjectionEnvelope>) {
      const topicMap = state.byTopic[action.payload.topic] ?? {}
      if (action.payload.operation === 'delete') {
        delete topicMap[action.payload.itemKey]
      } else {
        topicMap[action.payload.itemKey] = action.payload
      }
      state.byTopic[action.payload.topic] = topicMap
    },
    replaceSnapshot(state, action: PayloadAction<TdpProjectionEnvelope[]>) {
      state.byTopic = {}
      action.payload.forEach(item => {
        if (item.operation === 'delete') return
        const topicMap = state.byTopic[item.topic] ?? {}
        topicMap[item.itemKey] = item
        state.byTopic[item.topic] = topicMap
      })
    },
    resetProjection(state) {
      state.byTopic = {}
    },
  },
})

export const tdpProjectionActions = slice.actions

export const tdpProjectionConfig: ModuleSliceConfig<TdpProjectionState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: false,
}
