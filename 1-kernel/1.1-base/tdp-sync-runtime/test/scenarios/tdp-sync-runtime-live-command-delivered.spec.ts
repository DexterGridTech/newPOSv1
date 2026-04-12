import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpCommandInboxState,
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

describe('tdp-sync-runtime live command delivered', () => {
    it('receives real REMOTE_CONTROL command delivery and syncs ack result back to server outbox and task instance', async () => {
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
                    id: 'device-live-command-001',
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

        const sessions = await platform.admin.sessions()
        const activeSession = sessions[0]
        if (!activeSession?.terminalId) {
            throw new Error('missing live terminal session for command delivery')
        }

        const releaseResponse = await platform.admin.createTaskRelease({
            title: 'tdp-sync-runtime-live-remote-control',
            taskType: 'REMOTE_CONTROL',
            sourceType: 'COMMAND',
            sourceId: 'tdp-sync-runtime-live-test',
            priority: 1,
            targetTerminalIds: [activeSession.terminalId],
            payload: {
                topicKey: 'remote.control',
                commandType: 'OPEN_CASH_DRAWER',
                action: 'OPEN_CASH_DRAWER',
                instanceId: `instance-live-command-${Date.now()}`,
            },
        })

        const releaseId = releaseResponse?.release?.releaseId
        if (!releaseId) {
            throw new Error('failed to create live remote control release')
        }

        await waitFor(() => {
            const inbox = selectTdpCommandInboxState(runtime.getState())
            return Boolean(inbox?.orderedIds.length)
        })

        const inbox = selectTdpCommandInboxState(runtime.getState())
        const firstCommandId = inbox?.orderedIds[0]
        const deliveredCommand = firstCommandId ? inbox?.itemsById[firstCommandId] : undefined

        expect(deliveredCommand).toMatchObject({
            topic: 'remote.control',
            terminalId: activeSession.terminalId,
            payload: {
                commandType: 'OPEN_CASH_DRAWER',
                action: 'OPEN_CASH_DRAWER',
            },
            sourceReleaseId: releaseId,
        })

        const syncState = selectTdpSyncState(runtime.getState())
        expect(syncState?.lastAckedCursor).toBe(syncState?.lastCursor)

        await waitFor(async () => {
            const commandOutbox = await platform.admin.commandOutbox()
            const matchedCommand = commandOutbox.find(item => item.commandId === deliveredCommand?.commandId)
            return matchedCommand?.status === 'ACKED'
        }, 3_000)

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            const matchedInstance = taskInstances.find(item => item.instanceId === deliveredCommand?.payload.instanceId)
            return matchedInstance?.deliveryStatus === 'ACKED'
        }, 3_000)

        const commandOutbox = await platform.admin.commandOutbox()
        const ackedCommand = commandOutbox.find(item => item.commandId === deliveredCommand?.commandId)
        expect(ackedCommand).toMatchObject({
            status: 'ACKED',
            topicKey: 'remote.control',
            sourceReleaseId: releaseId,
        })

        const taskInstances = await platform.admin.taskInstances()
        const ackedInstance = taskInstances.find(item => item.instanceId === deliveredCommand?.payload.instanceId)
        expect(ackedInstance).toMatchObject({
            deliveryStatus: 'ACKED',
        })

        const trace = await platform.admin.getTaskTrace(deliveredCommand?.payload.instanceId as string)
        expect(trace.instance).toMatchObject({
            instance_id: deliveredCommand?.payload.instanceId,
            deliveryStatus: 'ACKED',
        })
    })
})
