import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import type {TimestampMs} from '@next/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@next/kernel-base-state-runtime'
import type {
    TdpProjectionEnvelope,
    TdpTopicActivitySource,
    TdpTopicActivityState,
    TdpTopicActivityStats,
} from '../../types'
import {TDP_TOPIC_ACTIVITY_STATE_KEY} from '../../foundations/stateKeys'
import {tdpSyncV2DomainActions} from './domainActions'

const DEFAULT_WINDOW_SIZE_MS = 60_000
const DEFAULT_MAX_WINDOWS = 5

const initialState: TdpTopicActivityState = {
    topics: {},
    windowSizeMs: DEFAULT_WINDOW_SIZE_MS,
    maxWindows: DEFAULT_MAX_WINDOWS,
}

const createEmptyStats = (): TdpTopicActivityStats => ({
    receivedCount: 0,
    appliedCount: 0,
    snapshotReceivedCount: 0,
    snapshotAppliedCount: 0,
    changesReceivedCount: 0,
    changesAppliedCount: 0,
    realtimeReceivedCount: 0,
    realtimeAppliedCount: 0,
    recentWindows: [],
})

const getWindowBucketStartedAt = (
    at: TimestampMs,
    windowSizeMs: number,
) => Math.floor(at / windowSizeMs) * windowSizeMs

const getOrCreateStats = (
    state: TdpTopicActivityState,
    topic: string,
) => {
    state.topics[topic] ??= createEmptyStats()
    return state.topics[topic]!
}

const incrementWindow = (
    state: TdpTopicActivityState,
    stats: TdpTopicActivityStats,
    at: TimestampMs,
    input: {
        receivedCount: number
        appliedCount: number
    },
) => {
    const bucketStartedAt = getWindowBucketStartedAt(at, state.windowSizeMs)
    let bucket = stats.recentWindows.find(window => window.bucketStartedAt === bucketStartedAt)
    if (!bucket) {
        bucket = {
            bucketStartedAt,
            receivedCount: 0,
            appliedCount: 0,
        }
        stats.recentWindows.push(bucket)
        stats.recentWindows.sort((left, right) => left.bucketStartedAt - right.bucketStartedAt)
        if (stats.recentWindows.length > state.maxWindows) {
            stats.recentWindows.splice(0, stats.recentWindows.length - state.maxWindows)
        }
    }

    bucket.receivedCount += input.receivedCount
    bucket.appliedCount += input.appliedCount
}

const appendTopicActivity = (
    state: TdpTopicActivityState,
    input: {
        topic: string
        source: TdpTopicActivitySource
        count: number
        receivedAt?: TimestampMs
        appliedAt: TimestampMs
    },
) => {
    if (input.count <= 0 || input.topic.length === 0) {
        return
    }
    const stats = getOrCreateStats(state, input.topic)
    const receivedAt = input.receivedAt ?? input.appliedAt

    stats.receivedCount += input.count
    stats.appliedCount += input.count
    stats.lastReceivedAt = receivedAt
    stats.lastAppliedAt = input.appliedAt
    stats.lastSource = input.source

    if (input.source === 'snapshot') {
        stats.snapshotReceivedCount += input.count
        stats.snapshotAppliedCount += input.count
    } else if (input.source === 'changes') {
        stats.changesReceivedCount += input.count
        stats.changesAppliedCount += input.count
    } else {
        stats.realtimeReceivedCount += input.count
        stats.realtimeAppliedCount += input.count
    }

    incrementWindow(state, stats, input.appliedAt, {
        receivedCount: input.count,
        appliedCount: input.count,
    })
}

const countTopics = (items: readonly TdpProjectionEnvelope[]) =>
    items.reduce<Record<string, number>>((result, item) => {
        result[item.topic] = (result[item.topic] ?? 0) + 1
        return result
    }, {})

const recordProjectionItems = (
    state: TdpTopicActivityState,
    input: {
        source: TdpTopicActivitySource
        items: readonly TdpProjectionEnvelope[]
        receivedAt?: TimestampMs
        appliedAt?: TimestampMs
    },
) => {
    const appliedAt = input.appliedAt ?? input.receivedAt ?? 0
    Object.entries(countTopics(input.items)).forEach(([topic, count]) => {
        appendTopicActivity(state, {
            topic,
            source: input.source,
            count,
            receivedAt: input.receivedAt,
            appliedAt,
        })
    })
}

const slice = createSlice({
    name: TDP_TOPIC_ACTIVITY_STATE_KEY,
    initialState,
    reducers: {
        resetTopicActivity(state) {
            state.topics = {}
        },
        recordTopicActivity(
            state,
            action: PayloadAction<{
                topic: string
                source: TdpTopicActivitySource
                count: number
                receivedAt?: TimestampMs
                appliedAt?: TimestampMs
            }>,
        ) {
            appendTopicActivity(state, {
                ...action.payload,
                appliedAt: action.payload.appliedAt ?? action.payload.receivedAt ?? 0,
            })
        },
    },
    extraReducers: builder => {
        builder
            .addCase(tdpSyncV2DomainActions.bootstrapResetRuntime, state => {
                state.topics = {}
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotLoaded, (state, action) => {
                recordProjectionItems(state, {
                    source: 'snapshot',
                    items: action.payload.snapshot,
                    receivedAt: action.payload.receivedAt,
                    appliedAt: action.payload.appliedAt,
                })
            })
            .addCase(tdpSyncV2DomainActions.applySnapshotChunk, (state, action) => {
                recordProjectionItems(state, {
                    source: 'snapshot',
                    items: action.payload.items,
                    receivedAt: action.payload.receivedAt,
                    appliedAt: action.payload.appliedAt,
                })
            })
            .addCase(tdpSyncV2DomainActions.applyChangesLoaded, (state, action) => {
                recordProjectionItems(state, {
                    source: 'changes',
                    items: action.payload.changes,
                    receivedAt: action.payload.receivedAt,
                    appliedAt: action.payload.appliedAt,
                })
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionReceived, (state, action) => {
                recordProjectionItems(state, {
                    source: 'realtime',
                    items: [action.payload.change],
                    receivedAt: action.payload.receivedAt,
                    appliedAt: action.payload.appliedAt,
                })
            })
            .addCase(tdpSyncV2DomainActions.applyProjectionBatchReceived, (state, action) => {
                recordProjectionItems(state, {
                    source: 'realtime',
                    items: action.payload.changes,
                    receivedAt: action.payload.receivedAt,
                    appliedAt: action.payload.appliedAt,
                })
            })
    },
})

export const tdpTopicActivityV2Actions = slice.actions

export const tdpTopicActivityV2SliceDescriptor: StateRuntimeSliceDescriptor<TdpTopicActivityState> = {
    name: TDP_TOPIC_ACTIVITY_STATE_KEY,
    reducer: slice.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
}
