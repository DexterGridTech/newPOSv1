import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {
    selectTcpAccessToken,
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    selectTcpTerminalId,
    tcpControlCommandNames,
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

describe('tcp-control-runtime live roundtrip', () => {
    it('activates terminal, refreshes credential, and reports task result back to mock-terminal-platform', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, '200000000001', 'device-live-tcp-001')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing live terminal id after activation')
        }

        expect(selectTcpIdentitySnapshot(runtime.getState())).toMatchObject({
            terminalId,
            deviceFingerprint: 'device-live-tcp-001',
            activationStatus: 'ACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            status: 'READY',
        })
        expect(selectTcpBindingSnapshot(runtime.getState())).toMatchObject({
            storeId: 'store-kernel-base-test',
            templateId: 'template-kernel-base-android-pos-standard',
        })

        const originalAccessToken = selectTcpAccessToken(runtime.getState())
        const refreshResult = await runtime.execute({
            commandName: tcpControlCommandNames.refreshCredential,
            payload: {},
            requestId: createRequestId(),
        })

        expect(refreshResult.status).toBe('completed')
        const refreshedAccessToken = selectTcpAccessToken(runtime.getState())
        expect(refreshedAccessToken).toBeTruthy()
        expect(refreshedAccessToken).not.toBe(originalAccessToken)

        const releaseResponse = await platform.admin.createTaskRelease({
            title: 'tcp-control-runtime-live-result-report',
            taskType: 'CONFIG_PUBLISH',
            sourceType: 'CONFIG',
            sourceId: 'tcp-control-runtime-live-test',
            priority: 10,
            targetTerminalIds: [terminalId],
            payload: {
                configVersion: 'config-live-report-v1',
                requestedBy: 'tcp-control-runtime-live-test',
            },
        })

        const releaseId = releaseResponse?.release?.releaseId
        if (!releaseId) {
            throw new Error('failed to create task release for tcp live roundtrip')
        }

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            return taskInstances.some(item => item.releaseId === releaseId && item.terminalId === terminalId)
        })

        const taskInstances = await platform.admin.taskInstances()
        const taskInstance = taskInstances.find(item => item.releaseId === releaseId && item.terminalId === terminalId)
        if (!taskInstance?.instanceId) {
            throw new Error('missing live task instance for tcp result reporting')
        }

        const reportResult = await runtime.execute({
            commandName: tcpControlCommandNames.reportTaskResult,
            payload: {
                instanceId: taskInstance.instanceId,
                status: 'COMPLETED',
                result: {
                    success: true,
                    reportedBy: 'tcp-control-runtime-live-roundtrip',
                },
            },
            requestId: createRequestId(),
        })

        expect(reportResult.status).toBe('completed')
        expect(selectTcpRuntimeState(runtime.getState())?.lastTaskReportRequestId).toBeTruthy()

        await waitFor(async () => {
            const trace = await platform.admin.getTaskTrace(taskInstance.instanceId)
            return trace.instance?.status === 'COMPLETED'
        })

        const trace = await platform.admin.getTaskTrace(taskInstance.instanceId)
        expect(trace.instance).toMatchObject({
            instanceId: taskInstance.instanceId,
            terminalId,
            deliveryStatus: 'DELIVERED',
            status: 'COMPLETED',
            result: {
                success: true,
                reportedBy: 'tcp-control-runtime-live-roundtrip',
            },
        })
    })
})
