import {afterEach, describe, expect, it} from 'vitest'
import {
    selectRuntimeShellV2ErrorCatalog,
    selectRuntimeShellV2ParameterCatalog,
} from '@next/kernel-base-runtime-shell-v2'
import {
    activateLiveTerminal,
    createLivePlatform,
    createLiveRuntime,
    readLiveTerminalScope,
    waitFor,
} from '../helpers/liveHarness'
import {createCommand} from '@next/kernel-base-runtime-shell-v2'
import {createRequestId} from '@next/kernel-base-contracts'
import {
    selectTdpSessionState,
    tdpSyncV2CommandDefinitions,
} from '../../src'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime-v2 live system catalog bridge', () => {
    it('bridges live error.message and system.parameter topic changes into runtime-shell catalogs', async () => {
        const platform = await createLivePlatform()
        platforms.push(platform)

        const {runtime} = createLiveRuntime({
            baseUrl: platform.baseUrl,
        })

        await runtime.start()
        await activateLiveTerminal(runtime, platform.prepare.sandboxId, '200000000008', 'device-live-tdp-v2-catalog-001')
        await runtime.dispatchCommand(
            createCommand(tdpSyncV2CommandDefinitions.connectTdpSession, {}),
            {requestId: createRequestId()},
        )
        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY', 5_000)

        const {terminalId, binding} = readLiveTerminalScope(runtime)
        const storeId = binding.storeId
        if (!storeId) {
            throw new Error('missing store id after terminal activation')
        }

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'error.message',
                    scopeType: 'STORE',
                    scopeKey: storeId,
                    itemKey: 'err.payment.timeout',
                    payload: {
                        template: 'store timeout',
                        updatedAt: 101,
                    },
                },
                {
                    topicKey: 'error.message',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'err.payment.timeout',
                    payload: {
                        template: 'terminal timeout',
                        updatedAt: 102,
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'STORE',
                    scopeKey: storeId,
                    itemKey: 'payment.retry.interval.ms',
                    payload: {
                        value: 3000,
                        updatedAt: 201,
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'payment.retry.interval.ms',
                    payload: {
                        value: 1500,
                        updatedAt: 202,
                    },
                },
            ],
        })

        await waitFor(() => {
            const errorCatalog = selectRuntimeShellV2ErrorCatalog(runtime.getState())
            const parameterCatalog = selectRuntimeShellV2ParameterCatalog(runtime.getState())
            return errorCatalog['err.payment.timeout']?.template === 'terminal timeout'
                && parameterCatalog['payment.retry.interval.ms']?.rawValue === 1500
        }, 5_000)

        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.payment.timeout']).toMatchObject({
            template: 'terminal timeout',
            updatedAt: 102,
            source: 'remote',
        })
        expect(selectRuntimeShellV2ParameterCatalog(runtime.getState())['payment.retry.interval.ms']).toMatchObject({
            rawValue: 1500,
            updatedAt: 202,
            source: 'remote',
        })

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'error.message',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'err.payment.timeout',
                    payload: {},
                },
                {
                    operation: 'delete',
                    topicKey: 'system.parameter',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'payment.retry.interval.ms',
                    payload: {},
                },
            ],
        })

        await waitFor(() => {
            const errorCatalog = selectRuntimeShellV2ErrorCatalog(runtime.getState())
            const parameterCatalog = selectRuntimeShellV2ParameterCatalog(runtime.getState())
            return errorCatalog['err.payment.timeout']?.template === 'store timeout'
                && parameterCatalog['payment.retry.interval.ms']?.rawValue === 3000
        }, 5_000)

        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.payment.timeout']).toMatchObject({
            template: 'store timeout',
            updatedAt: 101,
        })
        expect(selectRuntimeShellV2ParameterCatalog(runtime.getState())['payment.retry.interval.ms']).toMatchObject({
            rawValue: 3000,
            updatedAt: 201,
        })

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'error.message',
                    scopeType: 'STORE',
                    scopeKey: storeId,
                    itemKey: 'err.payment.timeout',
                    payload: {},
                },
                {
                    operation: 'delete',
                    topicKey: 'system.parameter',
                    scopeType: 'STORE',
                    scopeKey: storeId,
                    itemKey: 'payment.retry.interval.ms',
                    payload: {},
                },
            ],
        })

        await waitFor(() => {
            const errorCatalog = selectRuntimeShellV2ErrorCatalog(runtime.getState())
            const parameterCatalog = selectRuntimeShellV2ParameterCatalog(runtime.getState())
            return errorCatalog['err.payment.timeout'] == null
                && parameterCatalog['payment.retry.interval.ms'] == null
        }, 5_000)

        expect(selectRuntimeShellV2ErrorCatalog(runtime.getState())['err.payment.timeout']).toBeUndefined()
        expect(selectRuntimeShellV2ParameterCatalog(runtime.getState())['payment.retry.interval.ms']).toBeUndefined()
    }, 20_000)
})
