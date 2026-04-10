import {createDualTopologyHostServer, packageVersion} from '../src'
import {fetchJson} from './helpers/http'
import {createHello, createRuntimeInfo} from './helpers/runtimeInfo'
import {createTestWsClient} from './helpers/ws'
import {runtimeContracts} from '../src/runtime/runtimeDeps'

const main = async () => {
    const server = createDualTopologyHostServer({
        config: {
            port: 0,
            heartbeatIntervalMs: 100,
            heartbeatTimeoutMs: 5_000,
        },
    })

    await server.start()

    try {
        const addressInfo = server.getAddressInfo()
        const masterNodeId = runtimeContracts.createNodeId()
        const slaveNodeId = runtimeContracts.createNodeId()

        const ticket = await fetchJson<{
            success: boolean
            token: string
        }>(`${addressInfo.httpBaseUrl}/tickets`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                masterNodeId,
            }),
        })

        const master = await createTestWsClient(addressInfo.wsUrl)
        const slave = await createTestWsClient(addressInfo.wsUrl)

        try {
            master.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await master.waitForMessage(message => message.type === 'node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello did not establish a session')
            }
            const sessionId = masterAck.ack.sessionId

            slave.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            await slave.waitForMessage(message => message.type === 'node-hello-ack')

            master.send({
                type: 'command-dispatch',
                envelope: {
                    envelopeId: runtimeContracts.createEnvelopeId(),
                    sessionId,
                    requestId: runtimeContracts.createRequestId(),
                    commandId: runtimeContracts.createCommandId(),
                    ownerNodeId: masterNodeId,
                    sourceNodeId: masterNodeId,
                    targetNodeId: slaveNodeId,
                    commandName: 'scenario.demo.dispatch',
                    payload: {ok: true},
                    context: {},
                    sentAt: Date.now(),
                },
            })

            const relayed = await slave.waitForMessage(message => {
                return message.type === 'command-dispatch'
                    && message.envelope.commandName === 'scenario.demo.dispatch'
            })

            console.log('[dual-topology-host-test-scenario]', {
                packageName: '@impos2/dual-topology-host',
                packageVersion,
                addressInfo,
                sessionId,
                relayedType: relayed.type,
                stats: server.getStats(),
            })
        } finally {
            await Promise.all([
                master.close(),
                slave.close(),
            ])
        }
    } finally {
        await server.close()
    }
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})
