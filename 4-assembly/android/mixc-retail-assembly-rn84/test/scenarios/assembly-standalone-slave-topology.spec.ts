import {describe, expect, it, vi} from 'vitest'
import {
    createAssemblyTopologyBindingSource,
    importAssemblyTopologySharePayload,
} from '../../src/application/topology'

describe('assembly standalone slave topology', () => {
    it('normalizes a master share payload into masterLocator and binding seed', () => {
        const imported = importAssemblyTopologySharePayload({
            formatVersion: '2026.04',
            deviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        expect(imported.masterLocator).toMatchObject({
            masterDeviceId: 'MASTER-001',
            masterNodeId: 'master-node-001',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            serverAddress: [{address: 'ws://127.0.0.1:8888/mockMasterServer/ws'}],
        })
        expect(imported.bindingSeed).toMatchObject({
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
