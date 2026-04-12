import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {
    TdpProjectionEnvelope,
    TdpProjectionId,
    TdpProjectionState,
} from '../../types'
import {TDP_PROJECTION_STATE_KEY} from '../../foundations/stateKeys'

const toProjectionBucketKey = (input: TdpProjectionEnvelope) =>
    `${input.scopeType}:${input.scopeId}:${input.itemKey}`

export const toProjectionId = (input: TdpProjectionEnvelope): TdpProjectionId =>
    `${input.topic}:${input.scopeType}:${input.scopeId}:${input.itemKey}`

const initialState: TdpProjectionState = {}

const slice = createSlice({
    name: TDP_PROJECTION_STATE_KEY,
    initialState,
    reducers: {
        applyProjection(state, action: PayloadAction<TdpProjectionEnvelope>) {
            const projectionId = toProjectionId(action.payload)

            if (action.payload.operation === 'delete') {
                delete state[projectionId]
                return
            }

            state[projectionId] = action.payload
        },
        replaceSnapshot(state, action: PayloadAction<TdpProjectionEnvelope[]>) {
            Object.keys(state).forEach(key => {
                delete state[key]
            })
            action.payload.forEach(item => {
                if (item.operation === 'delete') {
                    return
                }
                const projectionId = toProjectionId(item)
                state[projectionId] = item
            })
        },
        resetProjection(state) {
            Object.keys(state).forEach(key => {
                delete state[key]
            })
        },
    },
})

export const tdpProjectionActions = slice.actions

export const tdpProjectionSliceDescriptor: StateRuntimeSliceDescriptor<TdpProjectionState> = {
    name: TDP_PROJECTION_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'record',
            storageKeyPrefix: 'entries',
            getEntries: state => state,
            shouldPersistEntry: (_entryKey, value) => value !== undefined,
            flushMode: 'immediate',
        },
    ],
}
