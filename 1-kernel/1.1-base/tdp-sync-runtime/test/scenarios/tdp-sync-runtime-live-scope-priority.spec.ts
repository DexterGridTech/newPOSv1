import {afterEach, describe, expect, it} from 'vitest'
import {createRequestId} from '@impos2/kernel-base-contracts'
import {selectTcpBindingSnapshot, selectTcpTerminalId, tcpControlCommandNames} from '@impos2/kernel-base-tcp-control-runtime'
import {
    selectTdpProjectionEntriesByTopic,
    selectTdpResolvedProjection,
    selectTdpSessionState,
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

describe('tdp-sync-runtime live scope priority', () => {
    it('keeps same-topic same-item projections across scopes and resolves by Platform<Project<Brand<Tenant<Store<Terminal', async () => {
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
                    id: 'device-live-scope-priority-001',
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
        if (!binding.platformId || !binding.projectId || !binding.brandId || !binding.tenantId || !binding.storeId || !terminalId) {
            throw new Error('missing terminal binding context')
        }

        await platform.admin.upsertProjectionBatch({
            projections: [
                {
                    topicKey: 'system.parameter',
                    scopeType: 'PLATFORM',
                    scopeKey: binding.platformId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 1000,
                        source: 'platform',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'PROJECT',
                    scopeKey: binding.projectId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 2000,
                        source: 'project',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'BRAND',
                    scopeKey: binding.brandId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 3000,
                        source: 'brand',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'TENANT',
                    scopeKey: binding.tenantId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 4000,
                        source: 'tenant',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'STORE',
                    scopeKey: binding.storeId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 5000,
                        source: 'store',
                    },
                },
                {
                    topicKey: 'system.parameter',
                    scopeType: 'TERMINAL',
                    scopeKey: terminalId,
                    itemKey: 'wsReconnectIntervalMs',
                    payload: {
                        value: 6000,
                        source: 'terminal',
                    },
                },
            ],
        })

        await waitFor(() => selectTdpProjectionEntriesByTopic(runtime.getState(), 'system.parameter').length === 6, 5_000)

        const entries = selectTdpProjectionEntriesByTopic(runtime.getState(), 'system.parameter')
        const resolved = selectTdpResolvedProjection(runtime.getState(), {
            topic: 'system.parameter',
            itemKey: 'wsReconnectIntervalMs',
        })

        expect(entries).toHaveLength(6)
        expect(entries.map(item => item.scopeType).sort()).toEqual([
            'BRAND',
            'PLATFORM',
            'PROJECT',
            'STORE',
            'TENANT',
            'TERMINAL',
        ])
        expect(resolved).toMatchObject({
            topic: 'system.parameter',
            itemKey: 'wsReconnectIntervalMs',
            scopeType: 'TERMINAL',
            scopeId: terminalId,
            payload: {
                value: 6000,
                source: 'terminal',
            },
        })
    })
})
