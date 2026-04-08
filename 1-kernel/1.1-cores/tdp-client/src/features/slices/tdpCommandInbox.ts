import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {ModuleSliceConfig} from '@impos2/kernel-core-base'
import {kernelCoreTdpClientState} from '../../types'
import type {TdpCommandInboxItem, TdpCommandInboxState} from '../../types'

const initialState: TdpCommandInboxState = {
  itemsById: {},
  orderedIds: [],
}

const slice = createSlice({
  name: kernelCoreTdpClientState.tdpCommandInbox,
  initialState,
  reducers: {
    pushCommand(state, action: PayloadAction<TdpCommandInboxItem>) {
      state.itemsById[action.payload.commandId] = action.payload
      if (!state.orderedIds.includes(action.payload.commandId)) {
        state.orderedIds.unshift(action.payload.commandId)
      }
    },
    resetCommandInbox(state) {
      state.itemsById = {}
      state.orderedIds = []
    },
  },
})

export const tdpCommandInboxActions = slice.actions

export const tdpCommandInboxConfig: ModuleSliceConfig<TdpCommandInboxState> = {
  name: slice.name,
  reducer: slice.reducer,
  persistToStorage: false,
}
