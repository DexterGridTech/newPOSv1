import {describe, expect, it, vi} from 'vitest'
import {
    createTopologyV3MasterLocatorFromSharePayload,
    parseTopologyV3SharePayload,
} from '@next/kernel-base-topology-runtime-v3'
import {
    createAssemblyTopologyBindingSource,
} from '../../src/application/topology'

describe('assembly standalone slave topology', () => {
    it('normalizes a master share payload into masterLocator and binding seed', () => {
        const sharePayload = parseTopologyV3SharePayload({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })
        const masterLocator = createTopologyV3MasterLocatorFromSharePayload(sharePayload)

        expect(masterLocator).toMatchObject({
            masterDeviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            serverAddress: [{address: 'ws://127.0.0.1:8888/mockMasterServer/ws'}],
        })
        expect({
            role: 'slave',
            masterNodeId: masterLocator.masterNodeId,
            masterDeviceId: masterLocator.masterDeviceId,
            wsUrl: masterLocator.serverAddress[0]?.address,
            httpBaseUrl: masterLocator.httpBaseUrl,
        })
            .toMatchObject({
                role: 'slave',
                masterNodeId: 'master-node-001',
                masterDeviceId: 'MASTER-001',
                wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
                httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            })
    })

    it('normalizes a compact master share payload into masterLocator and binding seed', () => {
        const sharePayload = parseTopologyV3SharePayload({
            v: '2026.04',
            d: 'MASTER-001',
            n: 'master-node-001',
            w: 'ws://127.0.0.1:8888/mockMasterServer/ws',
        })
        const masterLocator = createTopologyV3MasterLocatorFromSharePayload(sharePayload)

        expect(masterLocator).toMatchObject({
            masterDeviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            serverAddress: [{address: 'ws://127.0.0.1:8888/mockMasterServer/ws'}],
        })
        expect({
            role: 'slave',
            masterNodeId: masterLocator.masterNodeId,
            masterDeviceId: masterLocator.masterDeviceId,
            wsUrl: masterLocator.serverAddress[0]?.address,
            httpBaseUrl: masterLocator.httpBaseUrl,
        })
            .toMatchObject({
                role: 'slave',
                masterNodeId: 'master-node-001',
                masterDeviceId: 'MASTER-001',
                wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
                httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            })
    })

    it('clears runtime-only binding fields but keeps local identity', async () => {
        const bindingSource = createAssemblyTopologyBindingSource({
            role: 'slave',
            localNodeId: 'slave-node-001',
            masterNodeId: 'master-node-001',
            masterDeviceId: 'MASTER-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        bindingSource.clear()

        expect(bindingSource.get()).toEqual({
            role: 'slave',
            localNodeId: 'slave-node-001',
        })
    })
})
