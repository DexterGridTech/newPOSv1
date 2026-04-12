import type {TimestampMs} from '@impos2/kernel-base-contracts'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@impos2/kernel-base-state-runtime'
import {selectTdpCommandInboxState, type TdpCommandInboxItem} from '@impos2/kernel-base-tdp-sync-runtime'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'

export const TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME = 'kernel.base.topology-client-runtime.test.remote-command-panel'

export interface TerminalRemoteCommandPanelEntry {
    commandId: string
    instanceId: string
    topic: string
    terminalId: string
    action?: string
    commandType?: string
    businessKey?: string
    sourceReleaseId?: string | null
    payload: Record<string, unknown>
    receivedAt: TimestampMs
    updatedAt: TimestampMs
}

export type TerminalRemoteCommandPanelState = Record<string, TerminalRemoteCommandPanelEntry>

export const selectTerminalRemoteCommandPanelState = (
    state: Record<string, unknown>,
) => state[TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME] as TerminalRemoteCommandPanelState | undefined

const toRemoteCommandPanelEntry = (
    command: TdpCommandInboxItem,
): TerminalRemoteCommandPanelEntry | undefined => {
    const instanceId = typeof command.payload.instanceId === 'string'
        ? command.payload.instanceId
        : undefined
    if (!instanceId) {
        return undefined
    }

    return {
        commandId: command.commandId,
        instanceId,
        topic: command.topic,
        terminalId: command.terminalId,
        action: typeof command.payload.action === 'string' ? command.payload.action : undefined,
        commandType: typeof command.payload.commandType === 'string' ? command.payload.commandType : undefined,
        businessKey: typeof command.payload.businessKey === 'string' ? command.payload.businessKey : undefined,
        sourceReleaseId: command.sourceReleaseId ?? null,
        payload: command.payload,
        receivedAt: command.receivedAt,
        updatedAt: command.receivedAt,
    }
}

export const createTerminalRemoteCommandPanelModule = (): KernelRuntimeModule => {
    const slice = createSlice({
        name: TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME,
        initialState: {} as TerminalRemoteCommandPanelState,
        reducers: {
            putEntry(state, action: PayloadAction<TerminalRemoteCommandPanelEntry>) {
                state[action.payload.commandId] = action.payload
            },
        },
    })

    const descriptor: StateRuntimeSliceDescriptor<TerminalRemoteCommandPanelState> = {
        name: TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME,
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
                    } satisfies SyncValueEnvelope<TerminalRemoteCommandPanelEntry>,
                ]),
            ),
            applyEntries: (_state, entries) => {
                const next: TerminalRemoteCommandPanelState = {}
                Object.entries(entries).forEach(([entryKey, entryValue]) => {
                    if (!entryValue || entryValue.tombstone === true || !entryValue.value || typeof entryValue.value !== 'object') {
                        return
                    }
                    next[entryKey] = entryValue.value as TerminalRemoteCommandPanelEntry
                })
                return next
            },
        },
    }

    return {
        moduleName: 'kernel.base.topology-client-runtime.test.remote-command-panel-module',
        packageVersion: '0.0.1',
        stateSlices: [descriptor],
        install(context) {
            let lastFingerprint = ''
            context.subscribeState(() => {
                const inbox = selectTdpCommandInboxState(context.getState())
                const orderedCommands = (inbox?.orderedIds ?? [])
                    .map(commandId => inbox?.itemsById[commandId])
                    .filter((command): command is TdpCommandInboxItem => Boolean(command))
                    .sort((left, right) => left.receivedAt - right.receivedAt)
                const fingerprint = orderedCommands
                    .map(item => `${item.commandId}:${item.receivedAt}`)
                    .join('|')
                if (fingerprint === lastFingerprint) {
                    return
                }
                lastFingerprint = fingerprint

                orderedCommands.forEach(item => {
                    const entry = toRemoteCommandPanelEntry(item)
                    if (!entry) {
                        return
                    }
                    context.dispatchAction(slice.actions.putEntry(entry))
                })
            })
        },
    }
}
