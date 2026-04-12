import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyV2RecoveryState} from '../../types'
import {TOPOLOGY_V2_RECOVERY_STATE_KEY} from '../../foundations/stateKeys'

const slice = createSlice({
    name: TOPOLOGY_V2_RECOVERY_STATE_KEY,
    initialState: {} as TopologyV2RecoveryState,
    reducers: {
        replaceRecoveryState: (_state, action: PayloadAction<TopologyV2RecoveryState>) => ({
            ...action.payload,
        }),
        updateRecoveryState: (state, action: PayloadAction<TopologyV2RecoveryState>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV2RecoveryStateActions = slice.actions

export const topologyRuntimeV2RecoveryStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV2RecoveryState> = {
    name: TOPOLOGY_V2_RECOVERY_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {
            kind: 'field',
            stateKey: 'instanceMode',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'displayMode',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'enableSlave',
            flushMode: 'immediate',
        },
        {
            kind: 'field',
            stateKey: 'masterInfo',
            flushMode: 'immediate',
        },
    ],
}
