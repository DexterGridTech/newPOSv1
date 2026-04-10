import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {TopologyRecoveryState} from '../../types/state'

export const TOPOLOGY_RECOVERY_STATE_KEY = 'kernel.base.topology-runtime.recovery'

const slice = createSlice({
    name: TOPOLOGY_RECOVERY_STATE_KEY,
    initialState: {} as TopologyRecoveryState,
    reducers: {
        replaceRecoveryState: (_state, action: PayloadAction<TopologyRecoveryState>) => {
            return {...action.payload}
        },
        updateRecoveryState: (state, action: PayloadAction<TopologyRecoveryState>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRecoveryStateActions = slice.actions

export const topologyRecoveryStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyRecoveryState> = {
    name: TOPOLOGY_RECOVERY_STATE_KEY,
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
