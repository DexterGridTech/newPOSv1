import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TdpCommandInboxItem, TdpCommandInboxState} from '../../types'
import {TDP_COMMAND_INBOX_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

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
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, state => {
                state.itemsById = {}
                state.orderedIds = []
            })
            .addCase(tdpSyncV2DomainActions.recordCommandDelivered, (state, action) => {
                state.itemsById[action.payload.commandId] = action.payload
                if (!state.orderedIds.includes(action.payload.commandId)) {
                    state.orderedIds.unshift(action.payload.commandId)
                }
            })
    },
})

export const tdpCommandInboxV2Actions = slice.actions

export const tdpCommandInboxV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpCommandInboxState> = {
    name: TDP_COMMAND_INBOX_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
