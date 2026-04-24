import type {PayloadAction} from '@reduxjs/toolkit'
import {
    createWorkspaceStateSlice,
    createWorkspaceStateKeys,
    toWorkspaceStateDescriptors,
    type StateRuntimeSliceDescriptor,
    type SyncValueEnvelope,
} from '@next/kernel-base-state-runtime'
import {nowTimestampMs} from '@next/kernel-base-contracts'
import {uiRuntimeV2BaseStateKeys} from '../../foundations/stateKeys'
import type {UiOverlayEntry, UiOverlayRuntimeState} from '../../types'

export const uiRuntimeV2OverlayWorkspaceKeys = createWorkspaceStateKeys(
    uiRuntimeV2BaseStateKeys.overlay,
    ['main', 'branch'] as const,
)

const initialState: UiOverlayRuntimeState = {
    primaryOverlays: {
        value: [],
        updatedAt: 0,
    },
    secondaryOverlays: {
        value: [],
        updatedAt: 0,
    },
}

const getListEnvelope = (
    state: UiOverlayRuntimeState,
    displayMode: string,
) => (displayMode === 'SECONDARY'
    ? state.secondaryOverlays
    : state.primaryOverlays) as SyncValueEnvelope<UiOverlayEntry[]>

const overlayStateSlice = createWorkspaceStateSlice({
    baseName: uiRuntimeV2BaseStateKeys.overlay,
    values: ['main', 'branch'] as const,
    initialState,
    reducers: {
        openOverlay(
            state,
            action: PayloadAction<{
                displayMode: string
                overlay: UiOverlayEntry
            }>,
        ) {
            const envelope = getListEnvelope(state, action.payload.displayMode)
            const current = envelope.value ?? []
            envelope.value = [
                ...current.filter(item => item.id !== action.payload.overlay.id),
                action.payload.overlay,
            ]
            envelope.updatedAt = nowTimestampMs()
        },
        closeOverlay(
            state,
            action: PayloadAction<{
                displayMode: string
                overlayId: string
            }>,
        ) {
            const envelope = getListEnvelope(state, action.payload.displayMode)
            envelope.value = (envelope.value ?? []).filter(item => item.id !== action.payload.overlayId)
            envelope.updatedAt = nowTimestampMs()
        },
        clearOverlays(
            state,
            action: PayloadAction<{
                displayMode: string
            }>,
        ) {
            const envelope = getListEnvelope(state, action.payload.displayMode)
            envelope.value = []
            envelope.updatedAt = nowTimestampMs()
        },
        applyOverlaySnapshot(
            state,
            action: PayloadAction<Partial<Record<'primaryOverlays' | 'secondaryOverlays', SyncValueEnvelope<UiOverlayEntry[]> | undefined>>>,
        ) {
            const keys: Array<'primaryOverlays' | 'secondaryOverlays'> = ['primaryOverlays', 'secondaryOverlays']
            keys.forEach(key => {
                const incoming = action.payload[key]
                if (!incoming) {
                    return
                }
                if (state[key].updatedAt < incoming.updatedAt) {
                    state[key] = incoming
                }
            })
        },
    },
})

export const uiRuntimeV2OverlayStateActions = overlayStateSlice.actions

const overlaySyncDescriptor = {
    kind: 'record' as const,
    getEntries(state: UiOverlayRuntimeState) {
        return {
            primaryOverlays: state.primaryOverlays,
            secondaryOverlays: state.secondaryOverlays,
        }
    },
    applyEntries(
        state: UiOverlayRuntimeState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): UiOverlayRuntimeState {
        return {
            primaryOverlays: entries.primaryOverlays as SyncValueEnvelope<UiOverlayEntry[]> ?? state.primaryOverlays,
            secondaryOverlays: entries.secondaryOverlays as SyncValueEnvelope<UiOverlayEntry[]> ?? state.secondaryOverlays,
        }
    },
}

export const uiRuntimeV2OverlayStateSlices: StateRuntimeSliceDescriptor<UiOverlayRuntimeState>[] = [
    {
        name: uiRuntimeV2OverlayWorkspaceKeys.main,
        reducer: overlayStateSlice.reducers.main,
        persistIntent: 'owner-only',
        syncIntent: 'master-to-slave',
        persistence: [
            {kind: 'field', stateKey: 'primaryOverlays'},
            {kind: 'field', stateKey: 'secondaryOverlays'},
        ],
        sync: overlaySyncDescriptor,
    },
    {
        name: uiRuntimeV2OverlayWorkspaceKeys.branch,
        reducer: overlayStateSlice.reducers.branch,
        persistIntent: 'owner-only',
        syncIntent: 'slave-to-master',
        persistence: [
            {kind: 'field', stateKey: 'primaryOverlays'},
            {kind: 'field', stateKey: 'secondaryOverlays'},
        ],
        sync: overlaySyncDescriptor,
    },
]
