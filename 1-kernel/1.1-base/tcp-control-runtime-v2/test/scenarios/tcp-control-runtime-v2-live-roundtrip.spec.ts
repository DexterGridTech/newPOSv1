import {afterEach, describe, expect, it} from 'vitest'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {createRequestId} from '@next/kernel-base-contracts'
import {
    selectTcpAccessToken,
    selectTcpBindingSnapshot,
    selectTcpCredentialSnapshot,
    selectTcpIdentitySnapshot,
    selectTcpRuntimeState,
    selectTcpSandboxId,
    selectTcpTerminalId,
    tcpControlV2CommandDefinitions,
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

describe('tcp-control-runtime-v2 live roundtrip', () => {
    it('activates terminal, refreshes credential, and reports task result back to mock-terminal-platform', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, platform.prepare.sandboxId, '200000000001', 'device-live-tcp-v2-001')

        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!terminalId) {
            throw new Error('missing live terminal id after activation')
        }

        expect(selectTcpIdentitySnapshot(runtime.getState())).toMatchObject({
            terminalId,
            deviceFingerprint: 'device-live-tcp-v2-001',
            activationStatus: 'ACTIVATED',
        })
        expect(selectTcpCredentialSnapshot(runtime.getState())).toMatchObject({
            status: 'READY',
        })
        expect(selectTcpSandboxId(runtime.getState())).toBe(platform.prepare.sandboxId)
        expect(selectTcpBindingSnapshot(runtime.getState())).toMatchObject({
            storeId: 'store-kernel-base-test',
            templateId: 'template-kernel-base-android-pos-standard',
        })

        const originalAccessToken = selectTcpAccessToken(runtime.getState())
        const refreshResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.refreshCredential, {}),
            {requestId: createRequestId()},
        )

        expect(refreshResult.status).toBe('COMPLETED')
        const refreshedAccessToken = selectTcpAccessToken(runtime.getState())
        expect(refreshedAccessToken).toBeTruthy()
        expect(refreshedAccessToken).not.toBe(originalAccessToken)

        const releaseResponse = await platform.admin.createTaskRelease({
            title: 'tcp-control-runtime-v2-live-result-report',
            taskType: 'CONFIG_PUBLISH',
            sourceType: 'CONFIG',
            sourceId: 'tcp-control-runtime-v2-live-test',
            priority: 10,
            targetTerminalIds: [terminalId],
            payload: {
                configVersion: 'config-live-report-v2',
                requestedBy: 'tcp-control-runtime-v2-live-test',
            },
        })

        const releaseId = releaseResponse?.release?.releaseId
        if (!releaseId) {
            throw new Error('failed to create task release for tcp v2 live roundtrip')
        }

        await waitFor(async () => {
            const taskInstances = await platform.admin.taskInstances()
            return taskInstances.some(item => item.releaseId === releaseId && item.terminalId === terminalId)
        })

        const taskInstances = await platform.admin.taskInstances()
        const taskInstance = taskInstances.find(item => item.releaseId === releaseId && item.terminalId === terminalId)
        if (!taskInstance?.instanceId) {
            throw new Error('missing live task instance for tcp v2 result reporting')
        }

        const reportResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.reportTaskResult, {
                instanceId: taskInstance.instanceId,
                status: 'COMPLETED',
                result: {
                    success: true,
                    reportedBy: 'tcp-control-runtime-v2-live-roundtrip',
                },
            }),
            {requestId: createRequestId()},
        )

        expect(reportResult.status).toBe('COMPLETED')
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
                reportedBy: 'tcp-control-runtime-v2-live-roundtrip',
            },
        })

        const deactivateResult = await runtime.dispatchCommand(
            createCommand(tcpControlV2CommandDefinitions.deactivateTerminal, {
                reason: 'live-roundtrip-test',
            }),
            {requestId: createRequestId()},
        )

        expect(deactivateResult.status).toBe('COMPLETED')
        expect(selectTcpIdentitySnapshot(runtime.getState()).activationStatus).toBe('UNACTIVATED')

        await waitFor(async () => {
            const terminals = await platform.admin.terminals()
            return terminals.some(item => item.terminalId === terminalId && item.lifecycleStatus === 'DEACTIVATED')
        })

        const terminals = await platform.admin.terminals()
        expect(terminals.find(item => item.terminalId === terminalId)).toMatchObject({
            lifecycleStatus: 'DEACTIVATED',
            presenceStatus: 'OFFLINE',
        })
    })
})
