import {describe, expect, it, vi} from 'vitest'
import {createAssemblyTopologyInput} from '../../src/platform-ports/topology'
import {releaseInfo} from '../../src/generated/releaseInfo'

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
                ticketToken: 'ticket-001',
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
        expect(binding.profile.pathTemplate).toBe('/mockMasterServer/ws')
        expect(binding.socketRuntime.getServerCatalog().resolveAddresses('dual-topology-host')).toEqual([
            {
                addressName: 'native-topology-host',
                baseUrl: 'http://127.0.0.1:8888',
            },
        ])

        const hello = input?.assembly?.createHello({
            localNodeId: 'master:device-001',
        } as any)
        expect(hello?.runtime).toMatchObject({
            assemblyAppId: releaseInfo.appId,
            assemblyVersion: releaseInfo.assemblyVersion,
            buildNumber: releaseInfo.buildNumber,
            bundleVersion: releaseInfo.bundleVersion,
            runtimeVersion: releaseInfo.runtimeVersion,
        })
    })
})
