import type {TimestampMs} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {selectTdpProjectionState, type TdpProjectionEnvelope} from '@impos2/kernel-base-tdp-sync-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'

export const TERMINAL_TASK_PANEL_SLICE_NAME = 'kernel.base.topology-client-runtime.test.task-panel'

export interface TerminalTaskPanelEntry {
    instanceId: string
    releaseId: string
    taskType: string
    scopeId: string
    sourceReleaseId?: string | null
    revision: number
    payload: Record<string, unknown>
    dispatchedAt?: string
    updatedAt: TimestampMs
}

export type TerminalTaskPanelState = Record<string, TerminalTaskPanelEntry>

export const selectTerminalTaskPanelState = (
    state: Record<string, unknown>,
) => state[TERMINAL_TASK_PANEL_SLICE_NAME] as TerminalTaskPanelState | undefined

const toTaskPanelEntry = (
    projection: TdpProjectionEnvelope,
): TerminalTaskPanelEntry | undefined => {
    const payload = projection.payload
    if (typeof payload !== 'object' || payload == null) {
        return undefined
    }

    const releaseId = typeof payload.releaseId === 'string' ? payload.releaseId : undefined
    const instanceId = typeof payload.instanceId === 'string' ? payload.instanceId : projection.itemKey
    const taskPayload = typeof payload.payload === 'object' && payload.payload != null
        ? payload.payload as Record<string, unknown>
        : {}
    if (!releaseId || !instanceId) {
        return undefined
    }

    const taskType = typeof taskPayload.taskType === 'string'
        ? taskPayload.taskType
        : (
            typeof taskPayload.targetVersion === 'string'
                ? 'APP_UPGRADE'
                : 'CONFIG_PUBLISH'
        )

    return {
        instanceId,
        releaseId,
        taskType,
        scopeId: projection.scopeId,
        sourceReleaseId: projection.sourceReleaseId ?? null,
        revision: projection.revision,
        payload: taskPayload,
        dispatchedAt: typeof payload.dispatchedAt === 'string' ? payload.dispatchedAt : undefined,
        updatedAt: projection.revision as TimestampMs,
    }
}

export const createTerminalTaskPanelModule = (): KernelRuntimeModule => {
    const slice = createSlice({
        name: TERMINAL_TASK_PANEL_SLICE_NAME,
        initialState: {} as TerminalTaskPanelState,
        reducers: {
            putEntry(state, action: PayloadAction<TerminalTaskPanelEntry>) {
                const current = state[action.payload.instanceId]
                if (current && current.revision > action.payload.revision) {
                    return
                }
                state[action.payload.instanceId] = action.payload
            },
        },
    })

    const descriptor: StateRuntimeSliceDescriptor<TerminalTaskPanelState> = {
        name: TERMINAL_TASK_PANEL_SLICE_NAME,
        reducer: slice.reducer,
        persistIntent: 'never',
        syncIntent: 'master-to-slave',
        sync: {
            kind: 'record',
            getEntries: state => Object.fromEntries(
                Object.entries(state).map(([entryKey, entryValue]) => [
                    entryKey,
                    {
                        value: entryValue,
                        updatedAt: entryValue.updatedAt,
                    } satisfies SyncValueEnvelope<TerminalTaskPanelEntry>,
                ]),
            ),
            applyEntries: (_state, entries) => {
                const next: TerminalTaskPanelState = {}
                Object.entries(entries).forEach(([entryKey, entryValue]) => {
                    if (!entryValue || entryValue.tombstone === true || !entryValue.value || typeof entryValue.value !== 'object') {
                        return
                    }
                    next[entryKey] = entryValue.value as TerminalTaskPanelEntry
                })
                return next
            },
        },
    }

    return {
        moduleName: 'kernel.base.topology-client-runtime.test.task-panel-module',
        packageVersion: '0.0.1',
        stateSlices: [descriptor],
        install(context) {
            let lastFingerprint = ''
            context.subscribeState(() => {
                const topicState = selectTdpProjectionState(context.getState())?.byTopic['tcp.task.release'] ?? {}
                const orderedEntries = Object.values(topicState)
                    .sort((left, right) => left.revision - right.revision)
                const fingerprint = orderedEntries
                    .map(item => `${item.itemKey}:${item.revision}`)
                    .join('|')
                if (fingerprint === lastFingerprint) {
                    return
                }
                lastFingerprint = fingerprint

                orderedEntries.forEach(item => {
                    const entry = toTaskPanelEntry(item)
                    if (!entry) {
                        return
                    }
                    context.dispatchAction(slice.actions.putEntry(entry))
                })
            })
        },
    }
}
