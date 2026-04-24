import type {TimestampMs} from '@next/kernel-base-contracts'
import {
    defineCommand,
    onCommand,
    type ActorDefinition,
    type KernelRuntimeModuleV2,
} from '@next/kernel-base-runtime-shell-v2'
import type {StateRuntimeSliceDescriptor, SyncValueEnvelope} from '@next/kernel-base-state-runtime'
import {createSlice, type PayloadAction, type Reducer} from '@reduxjs/toolkit'
import {
    selectTdpCommandInboxState,
    selectTdpProjectionEntriesByTopic,
    selectTdpResolvedProjection,
    type TdpCommandInboxItem,
    type TdpProjectionEnvelope,
} from '../../src'

export const TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME = 'kernel.base.tdp-sync-runtime-v2.test.terminal-bridge'

export interface TerminalBridgeEntry {
    topic: string
    itemKey: string
    payload: unknown
    revision: number
    updatedAt: number
}

export type TerminalBridgeState = Record<string, TerminalBridgeEntry>

export const selectTerminalBridgeState = (
    state: Record<string, unknown>,
) => state[TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME] as TerminalBridgeState | undefined

export const TERMINAL_TOPOLOGY_BRIDGE_COMMAND = defineCommand<{
    topic: string
    itemKey: string
}>({
    moduleName: 'kernel.base.tdp-sync-runtime-v2.test.terminal-bridge',
    commandName: 'consume-projection',
})

export const TERMINAL_TASK_PANEL_SLICE_NAME = 'kernel.base.tdp-sync-runtime-v2.test.task-panel'

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

export const TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME = 'kernel.base.tdp-sync-runtime-v2.test.remote-command-panel'

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

const createSyncRecordSliceDescriptor = <TEntry extends {updatedAt: number}>(input: {
    name: string
    reducer: Reducer<Record<string, TEntry>>
}): StateRuntimeSliceDescriptor<Record<string, TEntry>> => ({
    name: input.name,
    reducer: input.reducer,
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
                } satisfies SyncValueEnvelope<TEntry>,
            ]),
        ),
        applyEntries: (_state, entries) => {
            const next: Record<string, TEntry> = {}
            Object.entries(entries).forEach(([entryKey, entryValue]) => {
                if (!entryValue || entryValue.tombstone === true || !entryValue.value || typeof entryValue.value !== 'object') {
                    return
                }
                next[entryKey] = entryValue.value as TEntry
            })
            return next
        },
    },
})

const projectionToBridgeEntry = (projection: TdpProjectionEnvelope): TerminalBridgeEntry => ({
    topic: projection.topic,
    itemKey: projection.itemKey,
    payload: projection.payload,
    revision: projection.revision,
    updatedAt: projection.revision,
})

export const createTerminalBridgeModuleV3 = (): KernelRuntimeModuleV2 => {
    const slice = createSlice({
        name: TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME,
        initialState: {} as TerminalBridgeState,
        reducers: {
            putEntry(state, action: PayloadAction<TerminalBridgeEntry>) {
                state[`${action.payload.topic}:${action.payload.itemKey}`] = action.payload
            },
        },
    })

    const actorDefinitions: ActorDefinition[] = [
        {
            moduleName: 'kernel.base.tdp-sync-runtime-v2.test.terminal-bridge-module',
            actorName: 'TerminalBridgeActor',
            handlers: [
                onCommand(TERMINAL_TOPOLOGY_BRIDGE_COMMAND, context => {
                    const projection = selectTdpResolvedProjection(context.getState(), {
                        topic: context.command.payload.topic,
                        itemKey: context.command.payload.itemKey,
                    })
                    if (!projection) {
                        throw new Error(`Missing TDP projection ${context.command.payload.topic}:${context.command.payload.itemKey}`)
                    }
                    context.dispatchAction(slice.actions.putEntry(projectionToBridgeEntry(projection)))
                    return {
                        entryKey: `${projection.topic}:${projection.itemKey}`,
                    }
                }),
            ],
        },
    ]

    return {
        moduleName: 'kernel.base.tdp-sync-runtime-v2.test.terminal-bridge-module',
        packageVersion: '0.0.1',
        stateSlices: [
            createSyncRecordSliceDescriptor<TerminalBridgeEntry>({
                name: TERMINAL_TOPOLOGY_BRIDGE_SLICE_NAME,
                reducer: slice.reducer,
            }),
        ],
        commandDefinitions: [TERMINAL_TOPOLOGY_BRIDGE_COMMAND],
        actorDefinitions,
    }
}

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

export const createTerminalTaskPanelModuleV3 = (): KernelRuntimeModuleV2 => {
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

    return {
        moduleName: 'kernel.base.tdp-sync-runtime-v2.test.task-panel-module',
        packageVersion: '0.0.1',
        stateSlices: [
            createSyncRecordSliceDescriptor<TerminalTaskPanelEntry>({
                name: TERMINAL_TASK_PANEL_SLICE_NAME,
                reducer: slice.reducer,
            }),
        ],
        install(context) {
            let lastFingerprint = ''
            context.subscribeState(() => {
                const orderedEntries = selectTdpProjectionEntriesByTopic(
                    context.getState(),
                    'tcp.task.release',
                ).sort((left, right) => left.revision - right.revision)
                const fingerprint = orderedEntries.map(item => `${item.itemKey}:${item.revision}`).join('|')
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

export const createTerminalRemoteCommandPanelModuleV3 = (): KernelRuntimeModuleV2 => {
    const slice = createSlice({
        name: TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME,
        initialState: {} as TerminalRemoteCommandPanelState,
        reducers: {
            putEntry(state, action: PayloadAction<TerminalRemoteCommandPanelEntry>) {
                state[action.payload.commandId] = action.payload
            },
        },
    })

    return {
        moduleName: 'kernel.base.tdp-sync-runtime-v2.test.remote-command-panel-module',
        packageVersion: '0.0.1',
        stateSlices: [
            createSyncRecordSliceDescriptor<TerminalRemoteCommandPanelEntry>({
                name: TERMINAL_REMOTE_COMMAND_PANEL_SLICE_NAME,
                reducer: slice.reducer,
            }),
        ],
        install(context) {
            let lastFingerprint = ''
            context.subscribeState(() => {
                const inbox = selectTdpCommandInboxState(context.getState())
                const orderedCommands = (inbox?.orderedIds ?? [])
                    .map(commandId => inbox?.itemsById[commandId])
                    .filter((command): command is TdpCommandInboxItem => Boolean(command))
                    .sort((left, right) => left.receivedAt - right.receivedAt)
                const fingerprint = orderedCommands.map(item => `${item.commandId}:${item.receivedAt}`).join('|')
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
