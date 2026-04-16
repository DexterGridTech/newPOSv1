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
        setEnableSlave: {commandName: 'topology-runtime-v2.set-enable-slave'},
        setInstanceMode: {commandName: 'topology-runtime-v2.set-instance-mode'},
        setDisplayMode: {commandName: 'topology-runtime-v2.set-display-mode'},
        setMasterInfo: {commandName: 'topology-runtime-v2.set-master-info'},
        refreshTopologyContext: {commandName: 'topology-runtime-v2.refresh-topology-context'},
        startTopologyConnection: {commandName: 'topology-runtime-v2.start-topology-connection'},
    },
    tcpCommandDefinitions: {
        bootstrapTcpControl: {commandName: 'tcp-control-runtime-v2.bootstrap-tcp-control'},
    },
}))

vi.mock('@impos2/kernel-base-runtime-shell-v2', async importOriginal => ({
    ...await importOriginal<typeof import('@impos2/kernel-base-runtime-shell-v2')>(),
    createCommand: createCommandMock,
}))

vi.mock('@impos2/kernel-base-topology-runtime-v2', () => ({
    topologyRuntimeV2CommandDefinitions: topologyCommandDefinitions,
}))

vi.mock('@impos2/kernel-base-tcp-control-runtime-v2', () => ({
    tcpControlV2CommandDefinitions: tcpCommandDefinitions,
}))

import {bootstrapAssemblyRuntime} from '../../src/application/bootstrapRuntime'

describe('assembly bootstrap runtime', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('boots a dual-screen slave with topology handshake and tcp bootstrap', async () => {
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
                ticketToken: 'ticket-001',
                wsUrl: 'ws://127.0.0.1:9541/dual-topology/ws',
            },
        })

        expect(dispatchCommand).toHaveBeenCalledTimes(6)
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
                definition: topologyCommandDefinitions.setMasterInfo,
                payload: {
                    masterInfo: {
                        deviceId: 'master-terminal',
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
                        id: 'terminal-001',
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
