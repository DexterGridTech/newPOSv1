import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpTerminalId, tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionEntriesByTopic,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncCommandNames,
} from '../../src'
import {
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime live batch upsert', () => {
    it('accepts explicit projection batch upsert and syncs all items to terminal', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await runtime.execute({
            commandName: tcpControlCommandNames.bootstrapTcpControl,
            payload: {
                deviceInfo: {
                    id: 'device-live-batch-upsert-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000005',
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before batch upsert')
        }

        const syncBefore = selectTdpSyncState(runtime.getState())
        const lastCursorBefore = syncBefore?.lastCursor ?? 0

        const result = await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'wf-a',
                    payload: {
                        workflowKey: 'wf-a',
                        title: 'A',
                    },
                },
                {
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'wf-b',
                    payload: {
                        workflowKey: 'wf-b',
                        title: 'B',
                    },
                },
                {
                    topicKey: 'workflow.definition.collection',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'wf-c',
                    payload: {
                        workflowKey: 'wf-c',
                        title: 'C',
                    },
                },
            ],
        })

        expect(result.total).toBe(3)
        expect(result.items).toHaveLength(3)
        expect(result.items.every((item: {targetTerminalIds: string[]}) => item.targetTerminalIds.includes(terminalId))).toBe(true)

        await waitFor(() => selectTdpProjectionEntriesByTopic(runtime.getState(), 'workflow.definition.collection').length === 3, 5_000)

        const entries = selectTdpProjectionEntriesByTopic(runtime.getState(), 'workflow.definition.collection')
        const syncAfter = selectTdpSyncState(runtime.getState())

        expect(entries.map(item => item.itemKey).sort()).toEqual(['wf-a', 'wf-b', 'wf-c'])
        expect(syncAfter?.lastCursor).toBeGreaterThan(lastCursorBefore)
        expect(syncAfter?.lastAckedCursor).toBe(syncAfter?.lastCursor)
        expect(syncAfter?.lastAppliedCursor).toBe(syncAfter?.lastCursor)
    })
})
