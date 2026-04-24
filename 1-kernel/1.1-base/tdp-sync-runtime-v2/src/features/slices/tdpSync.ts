import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TdpSyncState} from '../../types'
import {TDP_SYNC_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

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
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, state => {
                state.snapshotStatus = 'idle'
                state.changesStatus = 'idle'
                state.lastDeliveredCursor = undefined
                state.lastAckedCursor = undefined
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotLoaded, (state, action) => {
                state.snapshotStatus = 'ready'
                state.changesStatus = 'ready'
                state.lastCursor = action.payload.highWatermark
                state.lastDeliveredCursor = action.payload.highWatermark
                state.lastAckedCursor = action.payload.highWatermark
                state.lastAppliedCursor = action.payload.highWatermark
            })
            .addCase(tdpSyncV2DomainActions.applyChangesLoaded, (state, action) => {
                state.changesStatus = 'ready'
                state.lastCursor = action.payload.nextCursor
                state.lastDeliveredCursor = action.payload.nextCursor
                state.lastAckedCursor = action.payload.nextCursor
                state.lastAppliedCursor = action.payload.nextCursor
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionReceived, (state, action) => {
                state.lastCursor = action.payload.cursor
                state.lastDeliveredCursor = action.payload.cursor
                state.lastAckedCursor = action.payload.cursor
                state.lastAppliedCursor = action.payload.cursor
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionBatchReceived, (state, action) => {
                state.lastCursor = action.payload.nextCursor
                state.lastDeliveredCursor = action.payload.nextCursor
                state.lastAckedCursor = action.payload.nextCursor
                state.lastAppliedCursor = action.payload.nextCursor
            })
    },
})

export const tdpSyncV2Actions = slice.actions

export const tdpSyncV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpSyncState> = {
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
