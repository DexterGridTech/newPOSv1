import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {TopologyV3ConfigRuntimeState} from '../../types/state'
import {TOPOLOGY_V3_CONFIG_STATE_KEY} from '../../foundations/stateKeys'

const slice = createSlice({
    name: TOPOLOGY_V3_CONFIG_STATE_KEY,
    initialState: {} as TopologyV3ConfigRuntimeState,
    reducers: {
        replaceConfigState: (_state, action: PayloadAction<TopologyV3ConfigRuntimeState>) => ({
            ...action.payload,
        }),
        patchConfigState: (state, action: PayloadAction<Partial<TopologyV3ConfigRuntimeState>>) => {
            Object.assign(state, action.payload)
        },
    },
})

export const topologyRuntimeV3ConfigStateActions = slice.actions

export const topologyRuntimeV3ConfigStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3ConfigRuntimeState> = {
    name: TOPOLOGY_V3_CONFIG_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
    persistence: [
        {kind: 'field', stateKey: 'instanceMode', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'displayMode', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'enableSlave', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'masterLocator', flushMode: 'immediate'},
    ],
}
