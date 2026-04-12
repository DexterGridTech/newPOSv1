import {afterEach, describe, expect, it} from 'vitest'
import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {createRequestId, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {StateRuntimeSliceDescriptor} from '@impos2/kernel-base-state-runtime'
import type {KernelRuntimeModule} from '@impos2/kernel-base-runtime-shell'
import {selectTcpBindingSnapshot, selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime'
import {
    createLivePlatform,
    createLiveRuntime,
    activateAndConnectLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'
import {
    tdpSyncActorNames,
    type TdpTopicDataChangedPayload,
} from '../../src'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

const TOPIC_PROBE_SLICE = 'kernel.base.tdp-sync-runtime.test.topic-probe'

type TopicProbeChange = {
    operation: 'upsert' | 'delete'
    itemKey: string
    payload?: Record<string, unknown>
    revision?: number
}

type TopicProbeState = {
    events: Array<{
        topic: string
        changes: TopicProbeChange[]
        receivedAt: number
    }>
}

const topicProbeSlice = createSlice({
    name: TOPIC_PROBE_SLICE,
    initialState: {
        events: [],
    } satisfies TopicProbeState,
    reducers: {
        appendEvent(state, action: PayloadAction<TopicProbeState['events'][number]>) {
            state.events.push(action.payload)
        },
    },
})

const topicProbeStateSliceDescriptor: StateRuntimeSliceDescriptor<TopicProbeState> = {
    name: TOPIC_PROBE_SLICE,
    reducer: topicProbeSlice.reducer,
    persistIntent: 'owner-only',
    syncIntent: 'isolated',
}

const createTopicProbeModule = (topic: string): KernelRuntimeModule => ({
    moduleName: 'kernel.base.tdp-sync-runtime.test.topic-probe',
    packageVersion: '0.0.1',
    stateSlices: [topicProbeStateSliceDescriptor],
    install(context) {
        context.registerActor(
            tdpSyncActorNames.topicDataChanged,
            actorContext => {
                const payload = actorContext.payload as TdpTopicDataChangedPayload
                if (payload.topic !== topic) {
                    return
                }

                context.dispatchAction(
                    topicProbeSlice.actions.appendEvent({
                        topic: payload.topic,
                        changes: payload.changes.map(change => ({
                            operation: change.operation,
                            itemKey: change.itemKey,
                            payload: change.payload,
                            revision: change.revision,
                        })),
                        receivedAt: nowTimestampMs(),
                    }),
                )
            },
        )
    },
})

const selectTopicProbeEvents = (state: Record<string, unknown>) =>
    (state[TOPIC_PROBE_SLICE] as TopicProbeState | undefined)?.events ?? []

describe('tdp-sync-runtime live topic data changed actor', () => {
    it('broadcasts only effective topic changes so normal modules do not need scope-priority knowledge', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const harness = createLiveRuntime({
            baseUrl: platform.baseUrl,
            extraModules: [
                createTopicProbeModule('workflow.definition.collection'),
            ],
        })

        await harness.runtime.start()
        await activateAndConnectLiveRuntime(harness.runtime, {
            activationCode: '200000000004',
            deviceId: 'device-topic-probe-001',
        })

        const terminalId = selectTcpTerminalId(harness.runtime.getState())
        const binding = selectTcpBindingSnapshot(harness.runtime.getState())
        if (!terminalId || !binding.storeId) {
            throw new Error('missing binding context for topic probe test')
        }

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: 'workflow-a',
                    payload: {
                        workflowKey: 'workflow-a',
                        value: 'store-v1',
                    },
                },
                {
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'workflow-a',
                    payload: {
                        workflowKey: 'workflow-a',
                        value: 'terminal-v2',
                    },
                },
            ],
        })

        await waitFor(() => {
            const events = selectTopicProbeEvents(harness.runtime.getState())
            return events.length >= 1
        }, 5_000)

        let events = selectTopicProbeEvents(harness.runtime.getState())
        expect(events[events.length - 1]).toMatchObject({
            topic: 'workflow.definition.collection',
            changes: [
                {
                    operation: 'upsert',
                    itemKey: 'workflow-a',
                    payload: {
                        workflowKey: 'workflow-a',
                        value: 'terminal-v2',
                    },
                },
            ],
        })

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'workflow-a',
                    payload: {},
                },
            ],
        })

        await waitFor(() => {
            const nextEvents = selectTopicProbeEvents(harness.runtime.getState())
            const lastEvent = nextEvents[nextEvents.length - 1]
            return lastEvent?.changes[0]?.operation === 'upsert'
                && lastEvent?.changes[0]?.payload?.value === 'store-v1'
        }, 5_000)

        events = selectTopicProbeEvents(harness.runtime.getState())
        expect(events[events.length - 1]).toMatchObject({
            topic: 'workflow.definition.collection',
            changes: [
                {
                    operation: 'upsert',
                    itemKey: 'workflow-a',
                    payload: {
                        workflowKey: 'workflow-a',
                        value: 'store-v1',
                    },
                },
            ],
        })

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: 'workflow-a',
                    payload: {},
                },
            ],
        })

        await waitFor(() => {
            const nextEvents = selectTopicProbeEvents(harness.runtime.getState())
            const lastEvent = nextEvents[nextEvents.length - 1]
            return lastEvent?.changes[0]?.operation === 'delete'
                && lastEvent?.changes[0]?.itemKey === 'workflow-a'
        }, 5_000)

        events = selectTopicProbeEvents(harness.runtime.getState())
        expect(events[events.length - 1]).toMatchObject({
            topic: 'workflow.definition.collection',
            changes: [
                {
                    operation: 'delete',
                    itemKey: 'workflow-a',
                },
            ],
        })
    })
})
