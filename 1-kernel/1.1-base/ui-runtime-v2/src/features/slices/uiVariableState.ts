import type {PayloadAction} from '@reduxjs/toolkit'
import {
    createWorkspaceStateKeys,
    createWorkspaceStateSlice,
    toWorkspaceStateDescriptors,
    type StateRuntimeSliceDescriptor,
    type SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import {nowTimestampMs} from '@next/kernel-base-contracts'
import {uiRuntimeV2BaseStateKeys} from '../../foundations/stateKeys'
import type {UiVariableRuntimeState} from '../../types'

export const uiRuntimeV2VariableWorkspaceKeys = createWorkspaceStateKeys(
    uiRuntimeV2BaseStateKeys['ui-variable'],
    ['main', 'branch'] as const,
)

const initialState: UiVariableRuntimeState = {}

const uiVariableStateSlice = createWorkspaceStateSlice({
    baseName: uiRuntimeV2BaseStateKeys['ui-variable'],
    values: ['main', 'branch'] as const,
    initialState,
    reducers: {
        setUiVariables(
            state,
            action: PayloadAction<Record<string, unknown>>,
        ) {
            Object.entries(action.payload).forEach(([key, value]) => {
                state[key] = {
                    value,
                    updatedAt: nowTimestampMs(),
                }
            })
        },
        clearUiVariables(
            state,
            action: PayloadAction<readonly string[]>,
        ) {
            action.payload.forEach(key => {
                state[key] = {
                    value: null,
                    updatedAt: nowTimestampMs(),
                }
            })
        },
        applySyncEntries(
            state,
            action: PayloadAction<Record<string, SyncValueEnvelope | undefined>>,
        ) {
            for (const [key, incoming] of Object.entries(action.payload)) {
                if (!incoming) {
                    continue
                }
                if (incoming.tombstone === true) {
                    state[key] = incoming
                    continue
                }
                const local = state[key]
                if (!local || local.updatedAt < incoming.updatedAt) {
                    state[key] = incoming
                }
            }
        },
    },
})

export const uiRuntimeV2VariableStateActions = uiVariableStateSlice.actions

export const uiRuntimeV2VariableStateSlices = toWorkspaceStateDescriptors(
    ['main', 'branch'] as const,
    {
        name: uiRuntimeV2BaseStateKeys['ui-variable'],
        reducers: uiVariableStateSlice.reducers,
        persistIntent: 'owner-only',
        syncIntent: {
            main: 'master-to-slave',
            branch: 'slave-to-master',
        },
        persistence: {
            main: [
                {
                    kind: 'record',
                    storageKeyPrefix: 'ui-variable',
                },
            ],
            branch: [
                {
                    kind: 'record',
                    storageKeyPrefix: 'ui-variable',
                },
            ],
        },
        sync: {
            main: {
                kind: 'record',
            },
            branch: {
                kind: 'record',
            },
        },
    },
) satisfies StateRuntimeSliceDescriptor<UiVariableRuntimeState>[]
