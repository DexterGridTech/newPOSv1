import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpBindingSnapshot, selectTcpTerminalId, tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpSessionState,
    tdpSyncCommandNames,
    tdpSyncErrorDefinitions,
    tdpSyncParameterDefinitions,
} from '../../src'
import {selectErrorCatalogEntry, selectParameterCatalogEntry} from '@impos2/kernel-base-runtime-shell'
import {
    createLivePlatform,
    createLiveRuntime,
    waitFor,
} from '../helpers/liveHarness'

const platforms: Array<Awaited<ReturnType<typeof createLivePlatform>>> = []

afterEach(async () => {
    await Promise.all(platforms.splice(0).map(platform => platform.close()))
})

describe('tdp-sync-runtime live system catalog', () => {
    it('syncs remote error messages and system parameters from TDP projection topics with scope priority and delete fallback', async () => {
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
                    id: 'device-live-system-catalog-001',
                    model: 'Live Mock POS',
                },
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tcpControlCommandNames.activateTerminal,
            payload: {
                activationCode: '200000000004',
            },
            requestId: createRequestId(),
        })
        await runtime.execute({
            commandName: tdpSyncCommandNames.connectTdpSession,
            payload: {},
            requestId: createRequestId(),
        })

        await waitFor(() => selectTdpSessionState(runtime.getState())?.status === 'READY')

        const binding = selectTcpBindingSnapshot(runtime.getState())
        const terminalId = selectTcpTerminalId(runtime.getState())
        if (!binding.storeId || !terminalId) {
            throw new Error('missing terminal binding context for system catalog test')
        }

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'error.message',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: tdpSyncErrorDefinitions.protocolError.key,
                    payload: {
                        template: 'store protocol error template',
                    },
                },
                {
                    topicKey: 'error.message',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: tdpSyncErrorDefinitions.protocolError.key,
                    payload: {
                        template: 'terminal protocol error template',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                    payload: {
                        value: 5000,
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                    payload: {
                        value: 6000,
                    },
                },
            ],
        })

        await waitFor(() =>
            selectErrorCatalogEntry(runtime.getState(), tdpSyncErrorDefinitions.protocolError.key)?.template === 'terminal protocol error template'
            && selectParameterCatalogEntry(runtime.getState(), tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key)?.rawValue === 6000,
        5_000)

        expect(runtime.resolveError(tdpSyncErrorDefinitions.protocolError.key).message).toBe('terminal protocol error template')
        expect(runtime.resolveParameter<number>({
            key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
        }).value).toBe(6000)

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    operation: 'delete',
                    topicKey: 'error.message',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: tdpSyncErrorDefinitions.protocolError.key,
                    payload: {},
                },
                {
                    operation: 'delete',
                    topicKey: 'system.parameter',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
                    payload: {},
                },
            ],
        })

        await waitFor(() =>
            selectErrorCatalogEntry(runtime.getState(), tdpSyncErrorDefinitions.protocolError.key)?.template === 'store protocol error template'
            && selectParameterCatalogEntry(runtime.getState(), tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key)?.rawValue === 5000,
        5_000)

        expect(runtime.resolveError(tdpSyncErrorDefinitions.protocolError.key).message).toBe('store protocol error template')
        expect(runtime.resolveParameter<number>({
            key: tdpSyncParameterDefinitions.tdpReconnectIntervalMs.key,
        }).value).toBe(5000)
    })
})
