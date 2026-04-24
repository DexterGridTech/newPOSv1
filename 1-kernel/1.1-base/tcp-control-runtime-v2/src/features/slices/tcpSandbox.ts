import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
import type {TcpSandboxState} from '../../types'
import {TCP_SANDBOX_STATE_KEY} from '../../foundations/stateKeys'

const initialState: TcpSandboxState = {}

const slice = createSlice({
    name: TCP_SANDBOX_STATE_KEY,
    initialState,
    reducers: {
        setSandbox(
            state,
            action: PayloadAction<{
                sandboxId: string
                updatedAt: number
            }>,
        ) {
            state.sandboxId = action.payload.sandboxId
            state.updatedAt = action.payload.updatedAt as any
        },
        clearSandbox(state) {
            state.sandboxId = undefined
            state.updatedAt = undefined
        },
    },
})

export const tcpSandboxV2Actions = slice.actions

const tcpSandboxSyncDescriptor = {
    kind: 'record' as const,
    getEntries(state: TcpSandboxState) {
        const updatedAt = state.updatedAt ?? 0
        return {
            sandboxId: {value: state.sandboxId, updatedAt},
            updatedAt: {value: state.updatedAt, updatedAt},
        }
    },
    applyEntries(
        state: TcpSandboxState,
        entries: Readonly<Record<string, SyncValueEnvelope | undefined>>,
    ): TcpSandboxState {
        const resolveEntry = <TValue>(
            key: string,
            fallback: TValue,
            tombstoneFallback: TValue,
        ): TValue => {
            if (!Object.prototype.hasOwnProperty.call(entries, key)) {
                return fallback
            }
            const entry = entries[key]
            if (!entry || entry.tombstone) {
                return tombstoneFallback
            }
            return entry.value as TValue
        }
        return {
            sandboxId: resolveEntry<string | undefined>('sandboxId', state.sandboxId, undefined),
            updatedAt: resolveEntry<number | undefined>('updatedAt', state.updatedAt, undefined),
        }
    },
}

export const tcpSandboxV2SliceDescriptor: StateRuntimeSliceDescriptor<TcpSandboxState> = {
    name: TCP_SANDBOX_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'master-to-slave',
    persistence: [
        {kind: 'field', stateKey: 'sandboxId', flushMode: 'immediate'},
        {kind: 'field', stateKey: 'updatedAt', flushMode: 'immediate'},
    ],
    sync: tcpSandboxSyncDescriptor as any,
}
