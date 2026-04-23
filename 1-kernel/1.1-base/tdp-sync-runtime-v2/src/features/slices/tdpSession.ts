import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TdpSessionState, TdpSessionStatus} from '../../types'
import {TDP_SESSION_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

const initialState: TdpSessionState = {
    status: 'IDLE',
}

const slice = createSlice({
    name: TDP_SESSION_STATE_KEY,
    initialState,
    reducers: {
        setStatus(state, action: PayloadAction<TdpSessionStatus>) {
            state.status = action.payload
        },
        setReconnectAttempt(state, action: PayloadAction<number | undefined>) {
            state.reconnectAttempt = action.payload
        },
        setReady(
            state,
            action: PayloadAction<{
                sessionId: string
                nodeId: string
                nodeState: 'healthy' | 'grace' | 'degraded'
                highWatermark: number
                syncMode: 'incremental' | 'full'
                alternativeEndpoints: string[]
                connectedAt: number
            }>,
        ) {
            state.status = 'READY'
            state.reconnectAttempt = undefined
            state.sessionId = action.payload.sessionId
            state.nodeId = action.payload.nodeId
            state.nodeState = action.payload.nodeState
            state.highWatermark = action.payload.highWatermark
            state.syncMode = action.payload.syncMode
            state.alternativeEndpoints = action.payload.alternativeEndpoints
            state.connectedAt = action.payload.connectedAt as any
            state.disconnectReason = null
        },
        setLastPongAt(state, action: PayloadAction<number>) {
            state.lastPongAt = action.payload as any
        },
        setNodeState(state, action: PayloadAction<'healthy' | 'grace' | 'degraded' | undefined>) {
            state.nodeState = action.payload
        },
        setHighWatermark(state, action: PayloadAction<number | undefined>) {
            state.highWatermark = action.payload
        },
        setAlternativeEndpoints(state, action: PayloadAction<string[] | undefined>) {
            state.alternativeEndpoints = action.payload
        },
        setDisconnectReason(state, action: PayloadAction<string | null | undefined>) {
            state.disconnectReason = action.payload ?? null
        },
        resetSession() {
            return {
                ...initialState,
            }
        },
    },
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, () => ({
                ...initialState,
            }))
            .addCase(tdpSyncV2DomainActions.applySessionReady, (state, action) => {
                state.status = 'READY'
                state.reconnectAttempt = undefined
                state.sessionId = action.payload.sessionId
                state.nodeId = action.payload.nodeId
                state.nodeState = action.payload.nodeState
                state.highWatermark = action.payload.highWatermark
                state.syncMode = action.payload.syncMode
                state.alternativeEndpoints = action.payload.alternativeEndpoints
                state.connectedAt = action.payload.connectedAt as any
                state.disconnectReason = null
            })
            .addCase(tdpSyncV2DomainActions.applyPongReceived, (state, action) => {
                state.lastPongAt = action.payload.timestamp as any
            })
            .addCase(tdpSyncV2DomainActions.applyEdgeDegraded, (state, action) => {
                state.status = 'DEGRADED'
                state.nodeState = action.payload.nodeState
                state.alternativeEndpoints = action.payload.alternativeEndpoints
            })
            .addCase(tdpSyncV2DomainActions.applySessionRehomeRequired, (state, action) => {
                state.status = 'REHOME_REQUIRED'
                state.alternativeEndpoints = action.payload.alternativeEndpoints
            })
            .addCase(tdpSyncV2DomainActions.applyProtocolFailed, state => {
                state.status = 'ERROR'
            })
    },
})

export const tdpSessionV2Actions = slice.actions

export const tdpSessionV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpSessionState> = {
    name: TDP_SESSION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
