import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {
    StateRuntimeSliceDescriptor,
    SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import {
    TOPOLOGY_V3_DEMO_MASTER_STATE_KEY,
    TOPOLOGY_V3_DEMO_SLAVE_STATE_KEY,
} from '../../foundations/stateKeys'
import type {TopologyV3DemoEntryValue, TopologyV3DemoRecordState} from '../../types/state'

const createInitialState = (): TopologyV3DemoRecordState => ({})

const createDemoSyncDescriptor = (): StateRuntimeSliceDescriptor<TopologyV3DemoRecordState>['sync'] => ({
    kind: 'record',
    getEntries(state) {
        return state
    },
    applyEntries(
        state: TopologyV3DemoRecordState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): TopologyV3DemoRecordState {
        const next: TopologyV3DemoRecordState = {...state}
        for (const [key, entry] of Object.entries(entries)) {
            if (!entry || entry.tombstone === true) {
                delete next[key]
                continue
            }
            next[key] = entry as SyncValueEnvelope<TopologyV3DemoEntryValue>
        }
        return next
    },
})

const createDemoSlice = (sliceName: string) => createSlice({
    name: sliceName,
    initialState: createInitialState(),
    reducers: {
        replaceDemoState: (_state, action: PayloadAction<TopologyV3DemoRecordState>) => ({
            ...action.payload,
        }),
        upsertDemoEntry: (
            state,
            action: PayloadAction<{
                entryKey: string
                value: TopologyV3DemoEntryValue
                updatedAt: number
            }>,
        ) => {
            state[action.payload.entryKey] = {
                value: action.payload.value,
                updatedAt: action.payload.updatedAt as any,
            }
        },
        removeDemoEntry: (
            state,
            action: PayloadAction<{entryKey: string}>,
        ) => {
            delete state[action.payload.entryKey]
        },
        resetDemoState: () => createInitialState(),
    },
})

const demoMasterSlice = createDemoSlice(TOPOLOGY_V3_DEMO_MASTER_STATE_KEY)
const demoSlaveSlice = createDemoSlice(TOPOLOGY_V3_DEMO_SLAVE_STATE_KEY)

export const topologyRuntimeV3DemoSyncStateActions = {
    replaceDemoMasterState: demoMasterSlice.actions.replaceDemoState,
    upsertDemoMasterEntry: demoMasterSlice.actions.upsertDemoEntry,
    removeDemoMasterEntry: demoMasterSlice.actions.removeDemoEntry,
    resetDemoMasterState: demoMasterSlice.actions.resetDemoState,
    replaceDemoSlaveState: demoSlaveSlice.actions.replaceDemoState,
    upsertDemoSlaveEntry: demoSlaveSlice.actions.upsertDemoEntry,
    removeDemoSlaveEntry: demoSlaveSlice.actions.removeDemoEntry,
    resetDemoSlaveState: demoSlaveSlice.actions.resetDemoState,
}

export const topologyRuntimeV3DemoMasterStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3DemoRecordState> = {
    name: TOPOLOGY_V3_DEMO_MASTER_STATE_KEY,
    reducer: demoMasterSlice.reducer,
    persistIntent: 'never',
    syncIntent: 'master-to-slave',
    sync: createDemoSyncDescriptor(),
}

export const topologyRuntimeV3DemoSlaveStateSliceDescriptor: StateRuntimeSliceDescriptor<TopologyV3DemoRecordState> = {
    name: TOPOLOGY_V3_DEMO_SLAVE_STATE_KEY,
    reducer: demoSlaveSlice.reducer,
    persistIntent: 'never',
    syncIntent: 'slave-to-master',
    sync: createDemoSyncDescriptor(),
}
