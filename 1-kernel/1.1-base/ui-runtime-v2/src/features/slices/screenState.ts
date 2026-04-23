import type {PayloadAction} from '@reduxjs/toolkit'
import {
    createWorkspaceStateSlice,
    createWorkspaceStateKeys,
    toWorkspaceStateDescriptors,
    type StateRuntimeSliceDescriptor,
    type SyncValueEnvelope,
} from '@impos2/kernel-base-state-runtime'
import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import {uiRuntimeV2BaseStateKeys} from '../../foundations/stateKeys'
import type {UiScreenRuntimeEntry, UiScreenRuntimeState} from '../../types'

export const uiRuntimeV2ScreenWorkspaceKeys = createWorkspaceStateKeys(
    uiRuntimeV2BaseStateKeys.screen,
    ['main', 'branch'] as const,
)

const initialState: UiScreenRuntimeState = {}

const screenStateSlice = createWorkspaceStateSlice({
    baseName: uiRuntimeV2BaseStateKeys.screen,
    values: ['main', 'branch'] as const,
    initialState,
    reducers: {
        setScreen(
            state,
            action: PayloadAction<{
                containerKey: string
                entry: UiScreenRuntimeEntry
            }>,
        ) {
            state[action.payload.containerKey] = {
                value: action.payload.entry,
                updatedAt: nowTimestampMs(),
            }
        },
        resetScreen(
            state,
            action: PayloadAction<{
                containerKey: string
            }>,
        ) {
            state[action.payload.containerKey] = {
                value: null,
                updatedAt: nowTimestampMs(),
            }
        },
        applySyncEntries(
            state,
            action: PayloadAction<Record<string, SyncValueEnvelope<UiScreenRuntimeEntry | null> | undefined>>,
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

export const uiRuntimeV2ScreenStateActions = screenStateSlice.actions

export const uiRuntimeV2ScreenStateSlices = toWorkspaceStateDescriptors(
    ['main', 'branch'] as const,
    {
        name: uiRuntimeV2BaseStateKeys.screen,
        reducers: screenStateSlice.reducers,
        persistIntent: 'owner-only',
        syncIntent: {
            main: 'master-to-slave',
            branch: 'slave-to-master',
        },
        persistence: {
            main: [
                {
                    kind: 'record',
                    storageKeyPrefix: 'screen',
                },
            ],
            branch: [
                {
                    kind: 'record',
                    storageKeyPrefix: 'screen',
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
) satisfies StateRuntimeSliceDescriptor<UiScreenRuntimeState>[]
