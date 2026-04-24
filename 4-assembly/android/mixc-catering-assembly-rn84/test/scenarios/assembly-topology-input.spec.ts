import {describe, expect, it, vi} from 'vitest'
import {SERVER_NAME_DUAL_TOPOLOGY_HOST_V3} from '@next/kernel-server-config-v2'
import {createAssemblyTopologyBindingSource} from '../../src/application/topology'
import {createAssemblyTopologyInput} from '../../src/platform-ports/topology'

describe('assembly topology input', () => {
    it('creates topology socket binding from ws launch url without URL polyfill parsing', () => {
        const logger = {
            scope: vi.fn(() => logger),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }

        const input = createAssemblyTopologyInput({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                role: 'master',
                localNodeId: 'master:device-001',
                masterNodeId: 'master:device-001',
                masterDeviceId: 'device-001',
                wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
                httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            },
        }, logger as any)

        expect(input).toBeDefined()
        const binding = input?.assembly?.resolveSocketBinding({
            localNodeId: 'master:device-001',
        } as any)
        expect(binding).toBeDefined()
        expect(binding?.profile).toBeDefined()
        if (!binding?.profile) {
            throw new Error('Topology binding profile should exist')
        }
        expect(binding.profile.pathTemplate).toBe('/ws')
        expect(binding.socketRuntime.getServerCatalog().resolveAddresses(SERVER_NAME_DUAL_TOPOLOGY_HOST_V3)).toEqual([
            {
                addressName: 'dynamic-topology-host',
                baseUrl: 'http://127.0.0.1:8888/mockMasterServer',
            },
        ])

        const hello = input?.assembly?.createHelloRuntime({
            localNodeId: 'master:device-001',
        } as any)
        expect(hello).toMatchObject({
            nodeId: 'master:device-001',
            deviceId: 'device-001',
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            standalone: true,
            protocolVersion: '2026.04-v3',
        })
    })

    it('updates topology socket server and hello from a runtime binding source', () => {
        const logger = {
            scope: vi.fn(() => logger),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        const bindingSource = createAssemblyTopologyBindingSource({
            role: 'slave',
            localNodeId: 'slave-device-001',
        })
        const input = createAssemblyTopologyInput({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        }, logger as any, {bindingSource})

        expect(input).toBeDefined()
        bindingSource.set({
            role: 'slave',
            localNodeId: 'slave-device-001',
            masterNodeId: 'master-node-001',
            masterDeviceId: 'master-device-001',
            wsUrl: 'ws://127.0.0.1:9999/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:9999/mockMasterServer',
        })

        const binding = input?.assembly?.resolveSocketBinding({
            localNodeId: 'slave-device-001',
        } as any)
        expect(binding?.socketRuntime.getServerCatalog().resolveAddresses(SERVER_NAME_DUAL_TOPOLOGY_HOST_V3)).toEqual([{
            addressName: 'dynamic-topology-host',
            baseUrl: 'http://127.0.0.1:9999/mockMasterServer',
        }])

        const hello = input?.assembly?.createHelloRuntime({
            localNodeId: 'slave-device-001',
        } as any)
        expect(hello).toMatchObject({
            nodeId: 'slave-device-001',
            deviceId: 'device-001',
            instanceMode: 'SLAVE',
            displayMode: 'PRIMARY',
            standalone: true,
            protocolVersion: '2026.04-v3',
        })
        expect(binding?.profile).toBeDefined()
        if (!binding?.profile) {
            throw new Error('Topology binding profile should exist')
        }
        expect(binding.profile.pathTemplate).toBe('/ws')
    })

    it('prefers runtime wsUrl when resolving a dynamic topology socket path', () => {
        const logger = {
            scope: vi.fn(() => logger),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        const bindingSource = createAssemblyTopologyBindingSource({
            role: 'slave',
            localNodeId: 'slave-device-001',
        })
        const input = createAssemblyTopologyInput({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        }, logger as any, {bindingSource})

        bindingSource.set({
            role: 'slave',
            localNodeId: 'slave-device-001',
            masterNodeId: 'master-node-001',
            masterDeviceId: 'master-device-001',
            wsUrl: 'ws://127.0.0.1:9999/customTopology/ws',
            httpBaseUrl: 'http://127.0.0.1:9999/mockMasterServer',
        })

        const binding = input?.assembly?.resolveSocketBinding({
            localNodeId: 'slave-device-001',
        } as any)

        expect(binding?.socketRuntime.getServerCatalog().resolveAddresses(SERVER_NAME_DUAL_TOPOLOGY_HOST_V3)).toEqual([{
            addressName: 'dynamic-topology-host',
            baseUrl: 'http://127.0.0.1:9999/customTopology',
        }])
        expect(binding?.profile?.pathTemplate).toBe('/ws')
    })

    it('prefers topology runtime state over stale binding cache during first connection', () => {
        const logger = {
            scope: vi.fn(() => logger),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }
        const bindingSource = createAssemblyTopologyBindingSource({
            role: 'master',
            localNodeId: 'master-device-001',
        })
        const input = createAssemblyTopologyInput({
            deviceId: 'device-001',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: true,
        }, logger as any, {bindingSource})

        const runtimeContext = {
            localNodeId: 'master-device-001',
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            standalone: true,
            masterLocator: {
                masterNodeId: 'master-device-001',
                masterDeviceId: 'device-001',
                httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
                serverAddress: [{address: 'ws://127.0.0.1:8888/mockMasterServer/ws'}],
                addedAt: 1776811534054,
            },
        }

        const binding = input?.assembly?.resolveSocketBinding({
            localNodeId: 'master-device-001',
            getState: () => ({
                'kernel.base.topology-runtime-v3.context': runtimeContext,
            }),
        } as any)

        expect(binding?.socketRuntime.getServerCatalog().resolveAddresses(SERVER_NAME_DUAL_TOPOLOGY_HOST_V3)).toEqual([{
            addressName: 'dynamic-topology-host',
            baseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        }])
        expect(bindingSource.get()).toMatchObject({
            role: 'master',
            localNodeId: 'master-device-001',
            masterNodeId: 'master-device-001',
            masterDeviceId: 'device-001',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        const hello = input?.assembly?.createHelloRuntime({
            localNodeId: 'master-device-001',
            getState: () => ({
                'kernel.base.topology-runtime-v3.context': runtimeContext,
            }),
        } as any)

        expect(hello).toMatchObject({
            nodeId: 'master-device-001',
            instanceMode: 'MASTER',
            displayMode: 'PRIMARY',
            standalone: true,
        })
    })
})
