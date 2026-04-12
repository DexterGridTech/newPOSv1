import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    selectTcpTerminalId,
    tcpControlCommandNames,
} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpCommandInboxState,
    selectTdpSessionState,
    selectTdpSyncState,
    tdpSyncCommandNames,
} from '../../src'
import {
    activateAndConnectLiveRuntime,
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime live command result roundtrip', () => {
    it('acks remote control delivery through TDP and then reports final task result through TCP for the same instance', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateAndConnectLiveRuntime(runtime, {
            activationCode: '200000000006',
            deviceId: 'device-live-command-result-001',
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing terminal id before command result roundtrip')
        }

        const releaseResponse = await platform.admin.createTaskRelease({
            title: 'tdp-sync-runtime-live-command-result-roundtrip',
            taskType: 'REMOTE_CONTROL',
            sourceType: 'COMMAND',
            sourceId: 'tdp-sync-runtime-live-command-result-test',
            priority: 1,
            targetTerminalIds: [terminalId],
            payload: {
                topicKey: 'remote.control',
                commandType: 'SYNC_ORDER',
                action: 'SYNC_ORDER',
                businessKey: 'order-20260411-001',
            },
        })

        const releaseId = releaseResponse?.release?.releaseId
        if (!releaseId) {
            throw new Error('failed to create remote control release for command result roundtrip')
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
                businessKey: 'order-20260411-001',
            },
        })

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            const matchedInstance = taskInstances.find(item => item.instanceId === deliveredCommand.payload.instanceId)
            return matchedInstance?.deliveryStatus === 'ACKED'
        }, 5_000)

        const syncAfterAck = selectTdpSyncState(runtime.getState())
        expect(syncAfterAck?.lastAckedCursor).toBe(syncAfterAck?.lastCursor)

        const taskReportResult = await runtime.execute({
            commandName: tcpControlCommandNames.reportTaskResult,
            payload: {
                instanceId: deliveredCommand.payload.instanceId,
                status: 'COMPLETED',
                result: {
                    success: true,
                    finishedBy: 'tdp-sync-runtime-live-command-result-roundtrip',
                    commandId: deliveredCommand.commandId,
                },
            },
            requestId: createRequestId(),
        })

        expect(taskReportResult.status).toBe('completed')

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
                finishedBy: 'tdp-sync-runtime-live-command-result-roundtrip',
                commandId: deliveredCommand.commandId,
            },
        })
    })
})
