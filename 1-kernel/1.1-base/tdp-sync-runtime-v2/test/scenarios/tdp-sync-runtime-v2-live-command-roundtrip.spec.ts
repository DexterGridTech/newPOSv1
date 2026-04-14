import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@impos2/kernel-base-runtime-shell-v2'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlV2CommandDefinitions, selectTcpTerminalId} from '@impos2/kernel-base-tcp-control-runtime-v2'
import {
    selectTdpCommandInboxState,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncV2CommandDefinitions,
} from '../../src'
import {
    activateLiveTerminal,
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime-v2 live command roundtrip', () => {
    it('acks REMOTE_CONTROL delivery through TDP and reports final task result through TCP for the same instance', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, '200000000006', 'device-live-tdp-v2-command-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before command roundtrip')
        }

        const releaseResponse = await platform.admin.createTaskRelease({
            title: 'tdp-sync-runtime-v2-live-command-roundtrip',
            taskType: 'REMOTE_CONTROL',
            sourceType: 'COMMAND',
            sourceId: 'tdp-sync-runtime-v2-live-command-roundtrip-test',
            priority: 1,
            targetTerminalIds: [terminalId],
            payload: {
                topicKey: 'remote.control',
                commandType: 'SYNC_ORDER',
                action: 'SYNC_ORDER',
                businessKey: 'order-20260413-001',
            },
        })

        const releaseId = releaseResponse?.release?.releaseId
        if (!releaseId) {
            throw new Error('failed to create remote control release for live roundtrip')
        }

        await waitFor(() => {
            const inbox = selectTdpCommandInboxState(runtime.getState())
            return Boolean(inbox?.orderedIds.length)
        }, 5_000)

        const inbox = selectTdpCommandInboxState(runtime.getState())
        const commandId = inbox?.orderedIds[0]
        const deliveredCommand = commandId ? inbox?.itemsById[commandId] : undefined
        if (!deliveredCommand?.payload.instanceId) {
            throw new Error('missing delivered command instance id')
        }

        expect(deliveredCommand).toMatchObject({
            topic: 'remote.control',
            terminalId,
            sourceReleaseId: releaseId,
            payload: {
                commandType: 'SYNC_ORDER',
                action: 'SYNC_ORDER',
                businessKey: 'order-20260413-001',
            },
        })

        await waitFor(async () => {
            const commandOutbox = await platform.admin.commandOutbox()
            return commandOutbox.find(item => item.commandId === deliveredCommand.commandId)?.status === 'ACKED'
        }, 5_000)
        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            return taskInstances.find(item => item.instanceId === deliveredCommand.payload.instanceId)?.deliveryStatus === 'ACKED'
        }, 5_000)

        const syncAfterAck = selectTdpSyncState(runtime.getState())
        expect(syncAfterAck?.lastAckedCursor).toBe(syncAfterAck?.lastCursor)

        const taskReportResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.reportTaskResult, {
                instanceId: deliveredCommand.payload.instanceId as string,
                status: 'COMPLETED',
                result: {
                    success: true,
                    finishedBy: 'tdp-sync-runtime-v2-live-command-roundtrip',
                    commandId: deliveredCommand.commandId,
                },
            }),
            {requestId: createRequestId()},
        )

        expect(taskReportResult.status).toBe('COMPLETED')

        await waitFor(async () => {
            const trace = await platform.admin.getTaskTrace(deliveredCommand.payload.instanceId as string)
            return trace.instance?.status === 'COMPLETED'
        }, 5_000)

        const trace = await platform.admin.getTaskTrace(deliveredCommand.payload.instanceId as string)
        expect(trace.instance).toMatchObject({
            instanceId: deliveredCommand.payload.instanceId,
            terminalId,
            deliveryStatus: 'ACKED',
            status: 'COMPLETED',
            result: {
                success: true,
                finishedBy: 'tdp-sync-runtime-v2-live-command-roundtrip',
                commandId: deliveredCommand.commandId,
            },
        })
    })
})
