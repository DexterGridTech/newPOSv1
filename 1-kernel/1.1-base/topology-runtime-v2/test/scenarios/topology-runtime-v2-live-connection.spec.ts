import {afterEach, describe, expect, it} from 'vitest'
import {
    createCommand,
} from '@impos2/kernel-base-runtime-shell-v2'
import {
    selectTopologyRuntimeV2Connection,
    selectTopologyRuntimeV2Peer,
    topologyRuntimeV2CommandDefinitions,
} from '../../src'
import {createTopologyRuntimeV2LiveHarness, waitFor} from '../helpers/liveHarness'

const liveServers: Array<{close: () => Promise<void>}> = []

afterEach(async () => {
    await Promise.all(liveServers.splice(0).map(server => server.close()))
})

describe('topology-runtime-v2 live connection', () => {
    it('connects to dual-topology-host and receives hello ack peer info', async () => {
        const harness = await createTopologyRuntimeV2LiveHarness({
            profileName: 'dual-topology.ws.topology-runtime-v2.live',
        })
        liveServers.push(harness)

        const masterRuntime = harness.createMasterRuntime()
        const slaveRuntime = harness.createSlaveRuntime()

        await masterRuntime.start()
        await slaveRuntime.start()

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setEnableSlave, {
            enableSlave: true,
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setInstanceMode, {
            instanceMode: 'SLAVE',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setDisplayMode, {
            displayMode: 'PRIMARY',
        }))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.setMasterInfo, {
            masterInfo: {
                deviceId: 'master-device',
                serverAddress: [{address: harness.addressInfo.wsUrl}],
                addedAt: Date.now() as any,
            },
        }))

        await masterRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))
        await slaveRuntime.dispatchCommand(createCommand(topologyRuntimeV2CommandDefinitions.startTopologyConnection, {}))

        await waitFor(() => {
            return selectTopologyRuntimeV2Connection(masterRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
                && selectTopologyRuntimeV2Connection(slaveRuntime.getState())?.serverConnectionStatus === 'CONNECTED'
        }, 5_000)

        expect(selectTopologyRuntimeV2Peer(masterRuntime.getState())?.peerNodeId).toBeTruthy()
        expect(selectTopologyRuntimeV2Peer(slaveRuntime.getState())?.peerNodeId).toBeTruthy()
    })
})
