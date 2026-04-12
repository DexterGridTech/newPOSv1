import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TdpCommandInboxItem, TdpCommandInboxState} from '../../types'
import {TDP_COMMAND_INBOX_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TdpCommandInboxState = {
    itemsById: {},
    orderedIds: [],
}

const slice = createSlice({
    name: TDP_COMMAND_INBOX_STATE_KEY,
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

export const tdpCommandInboxSliceDescriptor: StateRuntimeSliceDescriptor<TdpCommandInboxState> = {
    name: TDP_COMMAND_INBOX_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
