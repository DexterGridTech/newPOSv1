import {createTestWsClientV3} from '../../../../../0-mock-server/dual-topology-host-v3/test/helpers/ws'
import {createDualTopologyHostV3Server} from '../../../../../0-mock-server/dual-topology-host-v3/src'
import {
    applyTopologyV3HelloAck,
    createTopologyV3InitialPairLinkState,
    markTopologyV3PairDisconnected,
} from '../../src/foundations/pairLinkController'

const createHello = (input: {
    helloId: string
    nodeId: string
    deviceId: string
    instanceMode: 'MASTER' | 'SLAVE'
    displayMode: 'PRIMARY' | 'SECONDARY'
    standalone: boolean
}) => {
    return {
        type: 'hello' as const,
        helloId: input.helloId,
        runtime: {
            nodeId: input.nodeId,
            deviceId: input.deviceId,
            instanceMode: input.instanceMode,
            displayMode: input.displayMode,
            standalone: input.standalone,
            protocolVersion: '2026.04-v3' as const,
            capabilities: ['state-sync', 'command-relay'],
        },
        sentAt: Date.now(),
    }
}

export const createTopologyRuntimeV3LiveHarness = async () => {
    const server = createDualTopologyHostV3Server({
        config: {
            port: 0,
        },
    })
    await server.start()

    const {wsUrl} = server.getAddressInfo()
    const master = await createTestWsClientV3(wsUrl)
    const slave = await createTestWsClientV3(wsUrl)

    let masterState = createTopologyV3InitialPairLinkState()
    let slaveState = createTopologyV3InitialPairLinkState()

    return {
        master: {
            getConnectionStatus: () => masterState.sync.status === 'active' ? 'ACTIVE' : 'IDLE',
            getPeerNodeId: () => masterState.peer.peerNodeId,
            getSessionId: () => masterState.sync.activeSessionId,
        },
        slave: {
            getConnectionStatus: () => slaveState.sync.status === 'active' ? 'ACTIVE' : 'IDLE',
            getPeerNodeId: () => slaveState.peer.peerNodeId,
            getSessionId: () => slaveState.sync.activeSessionId,
        },
        async start() {
            master.send(createHello({
                helloId: 'live-master',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck.type !== 'hello-ack' || !masterAck.accepted) {
                throw new Error('master hello failed')
            }
            masterState = applyTopologyV3HelloAck(masterState, masterAck)

            slave.send(createHello({
                helloId: 'live-slave',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            const slaveAck = await slave.waitForMessage(message => message.type === 'hello-ack')
            if (slaveAck.type !== 'hello-ack' || !slaveAck.accepted) {
                throw new Error('slave hello failed')
            }
            slaveState = applyTopologyV3HelloAck(slaveState, slaveAck)

            const masterPeerUpdate = await master.waitForMessage(message => {
                return message.type === 'hello-ack'
                    && message.helloId === 'live-slave:peer-update'
            })
            if (masterPeerUpdate.type === 'hello-ack' && masterPeerUpdate.accepted) {
                masterState = applyTopologyV3HelloAck(masterState, masterPeerUpdate)
            }
        },
        async close() {
            await Promise.allSettled([
                master.close(),
                slave.close(),
            ])
            await server.close()
            masterState = markTopologyV3PairDisconnected(masterState)
            slaveState = markTopologyV3PairDisconnected(slaveState)
        },
    }
}
