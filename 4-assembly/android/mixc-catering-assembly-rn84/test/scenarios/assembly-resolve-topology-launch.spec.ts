import {beforeEach, describe, expect, it, vi} from 'vitest'

const {prepareLaunchMock} = vi.hoisted(() => ({
    prepareLaunchMock: vi.fn(),
}))

vi.mock('../../src/turbomodules', () => ({
    nativeTopologyHost: {
        prepareLaunch: prepareLaunchMock,
    },
}))

import {resolveAssemblyTopologyLaunch} from '../../src/application/resolveTopologyLaunch'

describe('assembly topology launch resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('refreshes master topology launch from native topology host on the primary display', async () => {
        prepareLaunchMock.mockResolvedValue({
            masterNodeId: 'master-device-1',
            masterDeviceId: 'device-1',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })

        const topology = await resolveAssemblyTopologyLaunch({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: false,
            topology: {
                role: 'master',
                localNodeId: 'master-device-1',
                wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            },
        })

        expect(topology).toEqual({
            role: 'master',
            localNodeId: 'master-device-1',
            masterNodeId: 'master-device-1',
            masterDeviceId: 'device-1',
            wsUrl: 'ws://127.0.0.1:8888/mockMasterServer/ws',
            httpBaseUrl: 'http://127.0.0.1:8888/mockMasterServer',
        })
        expect(prepareLaunchMock).toHaveBeenCalledWith(2)
    })

    it('does not prepare dual-topology launch for a single-display terminal', async () => {
        const topology = await resolveAssemblyTopologyLaunch({
            deviceId: 'device-1',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: false,
        })

        expect(topology).toBeUndefined()
        expect(prepareLaunchMock).not.toHaveBeenCalled()
    })

    it('builds slave launch context from the native topology host handshake', async () => {
        prepareLaunchMock.mockResolvedValue({
            masterNodeId: 'master-node',
            masterDeviceId: 'master-device',
            wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            httpBaseUrl: 'http://127.0.0.1:9541/dual-topology',
        })

        const topology = await resolveAssemblyTopologyLaunch({
            deviceId: 'device-2',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 1,
            isEmulator: true,
        })

        expect(prepareLaunchMock).toHaveBeenCalledWith(2)
        expect(topology).toEqual({
            role: 'slave',
            localNodeId: 'master-node:display-1',
            masterNodeId: 'master-node',
            masterDeviceId: 'master-device',
            wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            httpBaseUrl: 'http://127.0.0.1:9541/dual-topology',
        })
    })

    it('falls back to the incoming props when native topology launch data is incomplete', async () => {
        prepareLaunchMock.mockResolvedValue({
            masterNodeId: 'master-node',
            wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
        })

        const topology = await resolveAssemblyTopologyLaunch({
            deviceId: 'device-3',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 1,
            isEmulator: false,
            topology: {
                role: 'slave',
                localNodeId: 'fallback-node',
            },
        })

        expect(topology).toEqual({
            role: 'slave',
            localNodeId: 'fallback-node',
        })
    })
})
