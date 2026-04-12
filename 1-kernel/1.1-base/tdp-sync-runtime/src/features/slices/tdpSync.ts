import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TdpSyncState} from '../../types'
import {TDP_SYNC_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TdpSyncState = {
    snapshotStatus: 'idle',
    changesStatus: 'idle',
}

const slice = createSlice({
    name: TDP_SYNC_STATE_KEY,
    initialState,
    reducers: {
        setSnapshotStatus(state, action: PayloadAction<TdpSyncState['snapshotStatus']>) {
            state.snapshotStatus = action.payload
        },
        setChangesStatus(state, action: PayloadAction<TdpSyncState['changesStatus']>) {
            state.changesStatus = action.payload
        },
        setLastCursor(state, action: PayloadAction<number | undefined>) {
            state.lastCursor = action.payload
        },
        setLastDeliveredCursor(state, action: PayloadAction<number | undefined>) {
            state.lastDeliveredCursor = action.payload
        },
        setLastAckedCursor(state, action: PayloadAction<number | undefined>) {
            state.lastAckedCursor = action.payload
        },
        setLastAppliedCursor(state, action: PayloadAction<number | undefined>) {
            state.lastAppliedCursor = action.payload
        },
        resetRuntimeState(state) {
            state.snapshotStatus = 'idle'
            state.changesStatus = 'idle'
            state.lastDeliveredCursor = undefined
            state.lastAckedCursor = undefined
        },
    },
})

export const tdpSyncActions = slice.actions

export const tdpSyncSliceDescriptor: StateRuntimeSliceDescriptor<TdpSyncState> = {
    name: TDP_SYNC_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'field',
            stateKey: 'lastCursor',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'lastAppliedCursor',
            flushMode: 'immediate',
        },
    ],
}
