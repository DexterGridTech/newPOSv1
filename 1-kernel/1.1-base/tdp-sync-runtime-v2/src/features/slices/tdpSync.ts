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
        setActiveSubscription(
            state,
            action: PayloadAction<{
                hash?: string
                topics?: readonly string[]
            }>,
        ) {
            state.activeSubscriptionHash = action.payload.hash
            state.activeSubscribedTopics = action.payload.topics == null
                ? undefined
                : [...action.payload.topics]
        },
        setRequestedSubscription(
            state,
            action: PayloadAction<{
                hash?: string
                topics?: readonly string[]
            }>,
        ) {
            state.lastRequestedSubscriptionHash = action.payload.hash
            state.lastRequestedSubscribedTopics = action.payload.topics == null
                ? undefined
                : [...action.payload.topics]
        },
        resetRuntimeState(state) {
            state.snapshotStatus = 'idle'
            state.changesStatus = 'idle'
            state.lastDeliveredCursor = undefined
            state.lastAckedCursor = undefined
            state.activeSubscriptionHash = undefined
            state.activeSubscribedTopics = undefined
            state.lastRequestedSubscriptionHash = undefined
            state.lastRequestedSubscribedTopics = undefined
            state.lastAcceptedSubscriptionHash = undefined
            state.lastAcceptedSubscribedTopics = undefined
        },
    },
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, state => {
                state.snapshotStatus = 'idle'
                state.changesStatus = 'idle'
                state.lastDeliveredCursor = undefined
                state.lastAckedCursor = undefined
                state.applyingSnapshotId = undefined
                state.applyingSnapshotTotalItems = undefined
                state.applyingSnapshotAppliedItems = undefined
            })
            .addCase(tdpSyncV2DomainActions.applySessionReady, (state, action) => {
                state.activeSubscriptionHash = action.payload.subscription?.hash
                state.activeSubscribedTopics = action.payload.subscription == null
                    ? undefined
                    : [...action.payload.subscription.acceptedTopics]
                state.lastAcceptedSubscriptionHash = action.payload.subscription?.hash
                state.lastAcceptedSubscribedTopics = action.payload.subscription == null
                    ? undefined
                    : [...action.payload.subscription.acceptedTopics]
                state.serverClockOffsetMs = action.payload.serverClockOffsetMs
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotLoaded, (state, action) => {
                state.snapshotStatus = 'ready'
                state.changesStatus = 'ready'
                state.lastCursor = action.payload.highWatermark
                state.lastDeliveredCursor = action.payload.highWatermark
                state.lastAckedCursor = action.payload.highWatermark
                state.lastAppliedCursor = action.payload.highWatermark
                state.applyingSnapshotId = undefined
                state.applyingSnapshotTotalItems = undefined
                state.applyingSnapshotAppliedItems = undefined
                if (action.payload.serverClockOffsetMs !== undefined) {
                    state.serverClockOffsetMs = action.payload.serverClockOffsetMs
                }
            })
            .addCase(tdpSyncV2DomainActions.beginSnapshotApply, (state, action) => {
                state.snapshotStatus = 'applying'
                state.changesStatus = 'catching-up'
                state.applyingSnapshotId = action.payload.snapshotId
                state.applyingSnapshotTotalItems = action.payload.totalItems
                state.applyingSnapshotAppliedItems = 0
                if (action.payload.serverClockOffsetMs !== undefined) {
                    state.serverClockOffsetMs = action.payload.serverClockOffsetMs
                }
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotChunk, (state, action) => {
                if (state.applyingSnapshotId !== action.payload.snapshotId) {
                    return
                }
                state.applyingSnapshotAppliedItems = (state.applyingSnapshotAppliedItems ?? 0)
                    + action.payload.items.length
            })
            .addCase(tdpSyncV2DomainActions.commitSnapshotApply, (state, action) => {
                if (state.applyingSnapshotId !== action.payload.snapshotId) {
                    return
                }
                state.snapshotStatus = 'ready'
                state.changesStatus = 'ready'
                state.lastCursor = action.payload.highWatermark
                state.lastDeliveredCursor = action.payload.highWatermark
                state.lastAckedCursor = action.payload.highWatermark
                state.lastAppliedCursor = action.payload.highWatermark
                state.applyingSnapshotId = undefined
                state.applyingSnapshotTotalItems = undefined
                state.applyingSnapshotAppliedItems = undefined
            })
            .addCase(tdpSyncV2DomainActions.applyChangesLoaded, (state, action) => {
                state.changesStatus = action.payload.hasMore ? 'catching-up' : 'ready'
                state.lastCursor = action.payload.nextCursor
                state.lastDeliveredCursor = action.payload.nextCursor
                state.lastAppliedCursor = action.payload.nextCursor
                if (action.payload.serverClockOffsetMs !== undefined) {
                    state.serverClockOffsetMs = action.payload.serverClockOffsetMs
                }
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionReceived, (state, action) => {
                state.lastCursor = action.payload.cursor
                state.lastDeliveredCursor = action.payload.cursor
                state.lastAppliedCursor = action.payload.cursor
                if (action.payload.serverClockOffsetMs !== undefined) {
                    state.serverClockOffsetMs = action.payload.serverClockOffsetMs
                }
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionBatchReceived, (state, action) => {
                state.lastCursor = action.payload.nextCursor
                state.lastDeliveredCursor = action.payload.nextCursor
                state.lastAppliedCursor = action.payload.nextCursor
                if (action.payload.serverClockOffsetMs !== undefined) {
                    state.serverClockOffsetMs = action.payload.serverClockOffsetMs
                }
            })
            .addCase(tdpSyncV2DomainActions.cleanupExpiredProjectionsCompleted, (state, action) => {
                state.lastExpiredProjectionCleanupAt = action.payload.cleanedAt as any
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
        {
            kind: 'field',
            stateKey: 'activeSubscriptionHash',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'activeSubscribedTopics',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'lastRequestedSubscriptionHash',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'lastRequestedSubscribedTopics',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'lastAcceptedSubscriptionHash',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'lastAcceptedSubscribedTopics',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'serverClockOffsetMs',
            flushMode: 'immediate',
        },
    ],
}
