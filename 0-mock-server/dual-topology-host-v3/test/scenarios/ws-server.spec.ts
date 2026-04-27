import {afterEach, describe, expect, it} from 'vitest'
import {createDualTopologyHostV3Server} from '../../src'
import {fetchJson} from '../helpers/http'
import {createTestWsClientV3} from '../helpers/ws'

const servers: Array<ReturnType<typeof createDualTopologyHostV3Server>> = []

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
            protocolVersion: '2026.04-v3',
            capabilities: ['state-sync', 'command-relay'],
        },
        sentAt: Date.now(),
    }
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('dual-topology-host-v3 ws server', () => {
    it('accepts one master and one slave over hello/hello-ack', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))

            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            expect(masterAck.type).toBe('hello-ack')
            if (masterAck.type === 'hello-ack') {
                expect(masterAck.accepted).toBe(true)
                expect(masterAck.sessionId).toBeDefined()
            }

            slave.send(createHello({
                helloId: 'hello-slave',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))

            const slaveAck = await slave.waitForMessage(message => message.type === 'hello-ack')
            expect(slaveAck.type).toBe('hello-ack')
            if (slaveAck.type === 'hello-ack') {
                expect(slaveAck.accepted).toBe(true)
                expect(slaveAck.sessionId).toBe(masterAck.type === 'hello-ack' ? masterAck.sessionId : undefined)
                expect(slaveAck.peerRuntime?.nodeId).toBe('master-node')
            }

            expect(server.getStats().sessionCount).toBe(1)
            await expect(fetchJson<{sessionCount: number}>(
                `${server.getAddressInfo().httpBaseUrl}/status`,
            )).resolves.toMatchObject({
                sessionCount: 1,
            })
        } finally {
            await Promise.all([master.close(), slave.close()])
        }
    })

    it('relays state, command, and request messages to the target peer', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master-relay',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck.type !== 'hello-ack' || !masterAck.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }

            slave.send(createHello({
                helloId: 'hello-slave-relay',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            const slaveAck = await slave.waitForMessage(message => message.type === 'hello-ack')
            expect(slaveAck.type).toBe('hello-ack')

            master.send({
                type: 'state-update',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                sliceName: 'demo',
                revision: 1,
                payload: {deviceId: 'master-device-updated'},
                sentAt: Date.now(),
            })

            const stateUpdate = await slave.waitForMessage(message => message.type === 'state-update')
            expect(stateUpdate.type).toBe('state-update')
            if (stateUpdate.type === 'state-update') {
                expect(stateUpdate.payload).toEqual({deviceId: 'master-device-updated'})
            }

            master.send({
                type: 'command-dispatch',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                commandId: 'command-1',
                commandName: 'demo.command',
                payload: {ok: true},
                sentAt: Date.now(),
            })

            const commandDispatch = await slave.waitForMessage(message => message.type === 'command-dispatch')
            expect(commandDispatch.type).toBe('command-dispatch')
            if (commandDispatch.type === 'command-dispatch') {
                expect(commandDispatch.commandName).toBe('demo.command')
                expect(commandDispatch.payload).toEqual({ok: true})
            }

            slave.send({
                type: 'request-snapshot',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'slave-node',
                targetNodeId: 'master-node',
                requests: [
                    {
                        requestId: 'request-1',
                        status: 'COMPLETED',
                        payload: {done: true},
                    },
                ],
                sentAt: Date.now(),
            })

            const requestSnapshot = await master.waitForMessage(message => message.type === 'request-snapshot')
            expect(requestSnapshot.type).toBe('request-snapshot')
            if (requestSnapshot.type === 'request-snapshot') {
                expect(requestSnapshot.requests).toEqual([
                    {
                        requestId: 'request-1',
                        status: 'COMPLETED',
                        payload: {done: true},
                    },
                ])
            }
        } finally {
            await Promise.all([master.close(), slave.close()])
        }
    })

    it('relays command-event messages back to the owner node when targetNodeId is omitted', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master-event-owner',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck.type !== 'hello-ack' || !masterAck.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }

            slave.send(createHello({
                helloId: 'hello-slave-event-owner',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            await slave.waitForMessage(message => message.type === 'hello-ack')

            slave.send({
                type: 'command-event',
                envelope: {
                    envelopeId: 'env-command-event-owner',
                    sessionId: masterAck.sessionId,
                    requestId: 'request-owner',
                    commandId: 'command-owner',
                    ownerNodeId: 'master-node',
                    sourceNodeId: 'slave-node',
                    eventType: 'completed',
                    result: {
                        requestId: 'request-owner',
                        commandId: 'command-owner',
                        commandName: 'demo.command',
                        target: 'peer',
                        status: 'COMPLETED',
                        startedAt: 1,
                        completedAt: 2,
                        actorResults: [],
                    },
                    occurredAt: Date.now(),
                },
            })

            const commandEvent = await master.waitForMessage(message => message.type === 'command-event')
            expect(commandEvent.type).toBe('command-event')
            if (commandEvent.type === 'command-event') {
                expect(commandEvent.envelope?.ownerNodeId).toBe('master-node')
                expect(commandEvent.envelope?.sourceNodeId).toBe('slave-node')
                expect(commandEvent.envelope?.eventType).toBe('completed')
            }
        } finally {
            await Promise.all([master.close(), slave.close()])
        }
    })

    it('rejects duplicate role occupancy', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const masterA = await createTestWsClientV3(wsUrl)
        const masterB = await createTestWsClientV3(wsUrl)

        try {
            masterA.send(createHello({
                helloId: 'hello-master-a',
                nodeId: 'master-a',
                deviceId: 'master-device-a',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))

            const accepted = await masterA.waitForMessage(message => message.type === 'hello-ack')
            expect(accepted.type).toBe('hello-ack')
            if (accepted.type === 'hello-ack') {
                expect(accepted.accepted).toBe(true)
            }

            masterB.send(createHello({
                helloId: 'hello-master-b',
                nodeId: 'master-b',
                deviceId: 'master-device-b',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))

            const rejected = await masterB.waitForMessage(message => message.type === 'hello-ack')
            expect(rejected.type).toBe('hello-ack')
            if (rejected.type === 'hello-ack') {
                expect(rejected.accepted).toBe(false)
                expect(rejected.rejectionCode).toBe('ROLE_OCCUPIED')
            }
        } finally {
            await Promise.all([masterA.close(), masterB.close()])
        }
    })

    it('relays envelope-based command dispatch and command event messages', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master-envelope',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck.type !== 'hello-ack' || !masterAck.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }

            slave.send(createHello({
                helloId: 'hello-slave-envelope',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            await slave.waitForMessage(message => message.type === 'hello-ack')

            master.send({
                type: 'command-dispatch',
                envelope: {
                    envelopeId: 'env-command-dispatch',
                    sessionId: masterAck.sessionId,
                    requestId: 'req-envelope',
                    commandId: 'cmd-envelope',
                    ownerNodeId: 'master-node',
                    sourceNodeId: 'master-node',
                    targetNodeId: 'slave-node',
                    commandName: 'demo.envelope.command',
                    payload: {ok: true},
                    context: {},
                    sentAt: Date.now(),
                },
            })

            const commandDispatch = await slave.waitForMessage(message => {
                return message.type === 'command-dispatch'
                    && message.envelope?.commandId === 'cmd-envelope'
            })
            expect(commandDispatch.type).toBe('command-dispatch')
            if (commandDispatch.type === 'command-dispatch') {
                expect(commandDispatch.envelope).toMatchObject({
                    targetNodeId: 'slave-node',
                    commandName: 'demo.envelope.command',
                    payload: {ok: true},
                })
            }

            slave.send({
                type: 'command-event',
                envelope: {
                    envelopeId: 'env-command-event',
                    sessionId: masterAck.sessionId,
                    requestId: 'req-envelope',
                    commandId: 'cmd-envelope',
                    ownerNodeId: 'master-node',
                    sourceNodeId: 'slave-node',
                    targetNodeId: 'master-node',
                    eventType: 'completed',
                    result: {
                        ok: true,
                    },
                    occurredAt: Date.now(),
                },
            })

            const commandEvent = await master.waitForMessage(message => {
                return message.type === 'command-event'
                    && message.envelope?.commandId === 'cmd-envelope'
            })
            expect(commandEvent.type).toBe('command-event')
            if (commandEvent.type === 'command-event') {
                expect(commandEvent.envelope).toMatchObject({
                    targetNodeId: 'master-node',
                    eventType: 'completed',
                    result: {
                        ok: true,
                    },
                })
            }
        } finally {
            await Promise.all([master.close(), slave.close()])
        }
    })

    it('applies relay delay, drop, and disconnect fault rules', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl, httpBaseUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master-fault',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck.type !== 'hello-ack' || !masterAck.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }

            slave.send(createHello({
                helloId: 'hello-slave-fault',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            await slave.waitForMessage(message => message.type === 'hello-ack')

            await fetchJson(`${httpBaseUrl}/fault-rules`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    rules: [
                        {
                            ruleId: 'delay-command',
                            kind: 'relay-delay',
                            channel: 'command-dispatch',
                            delayMs: 80,
                        },
                    ],
                }),
            })

            const delayStart = Date.now()
            master.send({
                type: 'command-dispatch',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                commandId: 'command-delay',
                commandName: 'demo.delay',
                payload: {value: 1},
                sentAt: Date.now(),
            })

            const delayedMessage = await slave.waitForMessage(message => {
                return message.type === 'command-dispatch' && message.commandId === 'command-delay'
            }, 500)
            expect(delayedMessage.type).toBe('command-dispatch')
            expect(Date.now() - delayStart).toBeGreaterThanOrEqual(70)

            await fetchJson(`${httpBaseUrl}/fault-rules`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    rules: [
                        {
                            ruleId: 'drop-command',
                            kind: 'relay-drop',
                            channel: 'command-dispatch',
                        },
                    ],
                }),
            })

            master.send({
                type: 'command-dispatch',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                commandId: 'command-drop',
                commandName: 'demo.drop',
                payload: {value: 2},
                sentAt: Date.now(),
            })

            await expect(
                slave.waitForMessage(message => {
                    return message.type === 'command-dispatch' && message.commandId === 'command-drop'
                }, 150),
            ).rejects.toThrow(/Timed out/)

            await fetchJson(`${httpBaseUrl}/fault-rules`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    rules: [
                        {
                            ruleId: 'disconnect-command',
                            kind: 'relay-disconnect-target',
                            channel: 'command-dispatch',
                        },
                    ],
                }),
            })

            master.send({
                type: 'command-dispatch',
                sessionId: masterAck.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                commandId: 'command-disconnect',
                commandName: 'demo.disconnect',
                payload: {value: 3},
                sentAt: Date.now(),
            })

            await expect(
                slave.waitForMessage(message => {
                    return message.type === 'command-dispatch' && message.commandId === 'command-disconnect'
                }, 150),
            ).rejects.toThrow(/Timed out/)

            await slave.close()
        } finally {
            await Promise.allSettled([master.close(), slave.close()])
        }
    })

    it('drops offline relay and recovers by fresh hello plus authoritative snapshot', async () => {
        const server = createDualTopologyHostV3Server({
            config: {
                port: 0,
            },
        })
        servers.push(server)
        await server.start()

        const {wsUrl} = server.getAddressInfo()
        const master = await createTestWsClientV3(wsUrl)
        const slave = await createTestWsClientV3(wsUrl)

        try {
            master.send(createHello({
                helloId: 'hello-master-reconnect-1',
                nodeId: 'master-node',
                deviceId: 'master-device',
                instanceMode: 'MASTER',
                displayMode: 'PRIMARY',
                standalone: true,
            }))
            const masterAck1 = await master.waitForMessage(message => message.type === 'hello-ack')
            if (masterAck1.type !== 'hello-ack' || !masterAck1.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }

            slave.send(createHello({
                helloId: 'hello-slave-reconnect-1',
                nodeId: 'slave-node',
                deviceId: 'slave-device',
                instanceMode: 'SLAVE',
                displayMode: 'SECONDARY',
                standalone: false,
            }))
            await slave.waitForMessage(message => message.type === 'hello-ack')

            await slave.close()

            master.send({
                type: 'command-dispatch',
                sessionId: masterAck1.sessionId,
                sourceNodeId: 'master-node',
                targetNodeId: 'slave-node',
                commandId: 'command-offline',
                commandName: 'demo.offline',
                payload: {value: 'should-drop'},
                sentAt: Date.now(),
            })

            const slaveReconnected = await createTestWsClientV3(wsUrl)
            try {
                master.send(createHello({
                    helloId: 'hello-master-reconnect-2',
                    nodeId: 'master-node',
                    deviceId: 'master-device',
                    instanceMode: 'MASTER',
                    displayMode: 'PRIMARY',
                    standalone: true,
                }))
                const masterAck2 = await master.waitForMessage(message => {
                    return message.type === 'hello-ack' && message.helloId === 'hello-master-reconnect-2'
                })
                if (masterAck2.type !== 'hello-ack' || !masterAck2.sessionId) {
                    throw new Error('Master reconnect ack missing sessionId')
                }

                slaveReconnected.send(createHello({
                    helloId: 'hello-slave-reconnect-2',
                    nodeId: 'slave-node',
                    deviceId: 'slave-device',
                    instanceMode: 'SLAVE',
                    displayMode: 'SECONDARY',
                    standalone: false,
                }))
                const slaveAck2 = await slaveReconnected.waitForMessage(message => {
                    return message.type === 'hello-ack' && message.helloId === 'hello-slave-reconnect-2'
                })
                expect(slaveAck2.type).toBe('hello-ack')

                await expect(
                    slaveReconnected.waitForMessage(message => {
                        return message.type === 'command-dispatch' && message.commandId === 'command-offline'
                    }, 150),
                ).rejects.toThrow(/Timed out/)

                master.send({
                    type: 'state-snapshot',
                    sessionId: masterAck2.sessionId,
                    sourceNodeId: 'master-node',
                    targetNodeId: 'slave-node',
                    entries: [
                        {
                            sliceName: 'device',
                            revision: 2,
                            payload: {
                                deviceId: 'master-device-recovered',
                            },
                        },
                    ],
                    sentAt: Date.now(),
                })

                const recoveredSnapshot = await slaveReconnected.waitForMessage(message => message.type === 'state-snapshot')
                expect(recoveredSnapshot.type).toBe('state-snapshot')
                if (recoveredSnapshot.type === 'state-snapshot') {
                    expect(recoveredSnapshot.entries).toEqual([
                        {
                            sliceName: 'device',
                            revision: 2,
                            payload: {
                                deviceId: 'master-device-recovered',
                            },
                        },
                    ])
                }
            } finally {
                await slaveReconnected.close()
            }
        } finally {
            await Promise.allSettled([master.close(), slave.close()])
        }
    })
})
