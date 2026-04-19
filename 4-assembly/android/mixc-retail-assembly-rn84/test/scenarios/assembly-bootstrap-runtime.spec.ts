import {beforeEach, describe, expect, it, vi} from 'vitest'

const {
    createCommandMock,
    topologyCommandDefinitions,
    tcpCommandDefinitions,
} = vi.hoisted(() => ({
    createCommandMock: vi.fn((definition, payload) => ({
        definition,
        payload,
    })),
    topologyCommandDefinitions: {
        setEnableSlave: {commandName: 'topology-runtime-v3.set-enable-slave'},
        setInstanceMode: {commandName: 'topology-runtime-v3.set-instance-mode'},
        setDisplayMode: {commandName: 'topology-runtime-v3.set-display-mode'},
        setMasterLocator: {commandName: 'topology-runtime-v3.set-master-locator'},
        refreshTopologyContext: {commandName: 'topology-runtime-v3.refresh-topology-context'},
        startTopologyConnection: {commandName: 'topology-runtime-v3.start-topology-connection'},
    },
    tcpCommandDefinitions: {
        bootstrapTcpControl: {commandName: 'tcp-control-runtime-v2.bootstrap-tcp-control'},
    },
}))

vi.mock('@impos2/kernel-base-runtime-shell-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@impos2/kernel-base-runtime-shell-v2')>(),
    createCommand: createCommandMock,
}))

vi.mock('@impos2/kernel-base-topology-runtime-v3', () => ({
    topologyRuntimeV3CommandDefinitions: topologyCommandDefinitions,
}))

vi.mock('@impos2/kernel-base-tcp-control-runtime-v2', () => ({
    tcpControlV2CommandDefinitions: tcpCommandDefinitions,
}))

import {bootstrapAssemblyRuntime} from '../../src/application/bootstrapRuntime'

describe('assembly bootstrap runtime', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('boots an embedded managed secondary without writing tcp identity locally', async () => {
        const dispatchCommand = vi.fn(async () => ({ok: true}))
        const runtime = {
            dispatchCommand,
        }

        await bootstrapAssemblyRuntime(runtime as any, {
            deviceId: 'terminal-001',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 1,
            isEmulator: false,
            topology: {
                role: 'slave',
                masterNodeId: 'master-terminal',
                masterDeviceId: 'master-device-001',
                wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            },
        })

        expect(dispatchCommand).toHaveBeenCalledTimes(5)
        expect((dispatchCommand.mock.calls as any[]).map(call => call[0])).toEqual([
            {
                definition: topologyCommandDefinitions.setInstanceMode,
                payload: {instanceMode: 'SLAVE'},
            },
            {
                definition: topologyCommandDefinitions.setDisplayMode,
                payload: {displayMode: 'SECONDARY'},
            },
            {
                definition: topologyCommandDefinitions.setMasterLocator,
                payload: {
                    masterLocator: {
                        masterNodeId: 'master-terminal',
                        masterDeviceId: 'master-device-001',
                        serverAddress: [{address: 'ws://127.0.0.1:9541/dual-topology/ws'}],
                        addedAt: expect.any(Number),
                    },
                },
            },
            {
                definition: topologyCommandDefinitions.refreshTopologyContext,
                payload: {},
            },
            {
                definition: topologyCommandDefinitions.startTopologyConnection,
                payload: {},
            },
        ])
    })

    it('boots a standalone slave primary with its own tcp identity and topology connection', async () => {
        const dispatchCommand = vi.fn(async () => ({ok: true}))
        const runtime = {
            dispatchCommand,
        }

        await bootstrapAssemblyRuntime(runtime as any, {
            deviceId: 'terminal-standalone-slave',
            screenMode: 'desktop',
            displayCount: 1,
            displayIndex: 0,
            isEmulator: false,
            topology: {
                role: 'slave',
                masterNodeId: 'master-terminal',
                masterDeviceId: 'master-device-standalone',
                wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            },
        })

        expect((dispatchCommand.mock.calls as any[]).map(call => call[0])).toEqual([
            {
                definition: topologyCommandDefinitions.setMasterLocator,
                payload: {
                    masterLocator: {
                        masterNodeId: 'master-terminal',
                        masterDeviceId: 'master-device-standalone',
                        serverAddress: [{address: 'ws://127.0.0.1:9541/dual-topology/ws'}],
                        addedAt: expect.any(Number),
                    },
                },
            },
            {
                definition: topologyCommandDefinitions.refreshTopologyContext,
                payload: {},
            },
            {
                definition: tcpCommandDefinitions.bootstrapTcpControl,
                payload: {
                    deviceInfo: {
                        id: 'terminal-standalone-slave',
                        model: 'Mixc Retail Android RN84',
                    },
                },
            },
            {
                definition: topologyCommandDefinitions.startTopologyConnection,
                payload: {},
            },
        ])
    })

    it('boots the master screen and enables slave orchestration before tcp init', async () => {
        const dispatchCommand = vi.fn(async () => ({ok: true}))
        const runtime = {
            dispatchCommand,
        }

        await bootstrapAssemblyRuntime(runtime as any, {
            deviceId: 'terminal-master',
            screenMode: 'desktop',
            displayCount: 2,
            displayIndex: 0,
            isEmulator: true,
            topology: {
                role: 'master',
            },
        })

        expect((dispatchCommand.mock.calls as any[]).map(call => call[0])).toEqual([
            {
                definition: topologyCommandDefinitions.setEnableSlave,
                payload: {enableSlave: true},
            },
            {
                definition: topologyCommandDefinitions.refreshTopologyContext,
                payload: {},
            },
            {
                definition: tcpCommandDefinitions.bootstrapTcpControl,
                payload: {
                    deviceInfo: {
                        id: 'terminal-master',
                        model: 'Mixc Retail Android RN84',
                    },
                },
            },
        ])
    })
})
