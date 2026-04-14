import {afterEach, describe, expect, it} from 'vitest'
import {
    createCommandId,
    createEnvelopeId,
    createNodeId,
    createRequestId,
    type StateSyncCommitAckEnvelope,
    type StateSyncDiffEnvelope,
    type StateSyncSummaryEnvelope,
    type CommandDispatchEnvelope,
    type RequestLifecycleSnapshotEnvelope,
} from '@impos2/kernel-base-contracts'
import {createDualTopologyHostServer} from '../../src'
import {fetchJson} from '../helpers/http'
import {createHello, createRuntimeInfo} from '../helpers/runtimeInfo'
import {
    createDualTopologyHostTestRuntime,
    createEchoModuleV2,
    createSilentRuntimeV2,
    selectRequestProjectionV2,
} from '../helpers/runtimeV2Harness'
import {createTestWsClient} from '../helpers/ws'

const servers: Array<ReturnType<typeof createDualTopologyHostServer>> = []

const waitFor = async (predicate: () => boolean, timeoutMs = 1_000) => {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for condition within ${timeoutMs}ms`)
        }
        await new Promise(resolve => setTimeout(resolve, 10))
    }
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()))
})

describe('dual-topology-host ws server', () => {
    it('relays dispatch over real sockets and blocks offline replay until resume completes', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterClient = await createTestWsClient(addressInfo.wsUrl)
        const slaveClient = await createTestWsClient(addressInfo.wsUrl)

        try {
            masterClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await masterClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(masterAck.type).toBe('node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }
            const sessionId = masterAck.ack.sessionId

            const masterHeartbeat = await masterClient.waitForMessage(message => message.type === '__host_heartbeat')
            expect(masterHeartbeat.type).toBe('__host_heartbeat')
            if (masterHeartbeat.type === '__host_heartbeat') {
                masterClient.send({
                    type: '__host_heartbeat_ack',
                    timestamp: masterHeartbeat.timestamp,
                })
            }

            slaveClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            const slaveAck = await slaveClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(slaveAck.type).toBe('node-hello-ack')

            const liveDispatch: CommandDispatchEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId,
                requestId: createRequestId(),
                commandId: createCommandId(),
                ownerNodeId: masterNodeId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
                commandName: 'demo.command.live',
                payload: {stage: 'live'},
                context: {},
                sentAt: Date.now(),
            }

            masterClient.send({
                type: 'command-dispatch',
                envelope: liveDispatch,
            })

            const relayedLiveDispatch = await slaveClient.waitForMessage(message => {
                return message.type === 'command-dispatch'
                    && message.envelope.commandName === 'demo.command.live'
            })

            expect(relayedLiveDispatch.type).toBe('command-dispatch')
            if (relayedLiveDispatch.type === 'command-dispatch') {
                expect(relayedLiveDispatch.envelope.payload).toEqual({stage: 'live'})
            }

            await slaveClient.close()
            await waitFor(() => {
                const session = server.host.hostRuntime.getSession(sessionId)
                const slaveNode = session?.nodes[slaveNodeId]
                return Boolean(slaveNode && slaveNode.connected === false)
            })

            const queuedDispatch: CommandDispatchEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId,
                requestId: createRequestId(),
                commandId: createCommandId(),
                ownerNodeId: masterNodeId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
                commandName: 'demo.command.resume',
                payload: {stage: 'queued-while-offline'},
                context: {},
                sentAt: Date.now(),
            }

            masterClient.send({
                type: 'command-dispatch',
                envelope: queuedDispatch,
            })

            const resumedSlaveClient = await createTestWsClient(addressInfo.wsUrl)
            try {
                resumedSlaveClient.send({
                    type: 'node-hello',
                    hello: createHello(ticket.token, createRuntimeInfo({
                        nodeId: slaveNodeId,
                        deviceId: 'slave-device',
                        role: 'slave',
                    })),
                })

                const resumedAck = await resumedSlaveClient.waitForMessage(message => message.type === 'node-hello-ack')
                expect(resumedAck.type).toBe('node-hello-ack')

                await expect(
                    resumedSlaveClient.waitForMessage(message => {
                        return message.type === 'command-dispatch'
                            && message.envelope.commandName === 'demo.command.resume'
                    }, 120),
                ).rejects.toThrow(/Timed out/)

                resumedSlaveClient.send({
                    type: 'resume-begin',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now(),
                })

                resumedSlaveClient.send({
                    type: 'resume-complete',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now() + 1,
                })

                const resumedDispatch = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'command-dispatch'
                        && message.envelope.commandName === 'demo.command.resume'
                })

                expect(resumedDispatch.type).toBe('command-dispatch')
                if (resumedDispatch.type === 'command-dispatch') {
                    expect(resumedDispatch.envelope.payload).toEqual({stage: 'queued-while-offline'})
                }
            } finally {
                await resumedSlaveClient.close()
            }
        } finally {
            await masterClient.close()
        }
    })

    it('completes remote command round-trip over real ws and converges owner projection', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

        const ownerRuntime = createDualTopologyHostTestRuntime({
            localNodeId: masterNodeId,
            loggerModuleName: 'mock.server.dual-topology-host.test.owner-runtime-v2',
            modules: [createEchoModuleV2()],
        })
        await ownerRuntime.start()

        const peerRuntime = createDualTopologyHostTestRuntime({
            localNodeId: slaveNodeId,
            loggerModuleName: 'mock.server.dual-topology-host.test.peer-runtime-v2',
            modules: [createEchoModuleV2()],
        })
        await peerRuntime.start()

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

        const masterClient = await createTestWsClient(addressInfo.wsUrl)
        const slaveClient = await createTestWsClient(addressInfo.wsUrl)

        try {
            masterClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await masterClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(masterAck.type).toBe('node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }
            const sessionId = masterAck.ack.sessionId

            slaveClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            const slaveAck = await slaveClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(slaveAck.type).toBe('node-hello-ack')

            const requestId = createRequestId()
            const rootResult = await ownerRuntime.execute({
                commandName: 'mock.server.dual-topology-host.test.echo',
                payload: {owner: 'local-root'},
                requestId,
            })

            expect(rootResult.status).toBe('COMPLETED')

            const rootCommandId = ownerRuntime
                .exportRequestLifecycleSnapshot(requestId, sessionId)
                ?.rootCommandId

            if (!rootCommandId) {
                throw new Error('Owner runtime snapshot missing root command id')
            }

            const remoteDispatchEnvelope = ownerRuntime.createRemoteDispatchEnvelope({
                requestId,
                sessionId,
                parentCommandId: rootCommandId,
                targetNodeId: slaveNodeId,
                commandName: 'mock.server.dual-topology-host.test.echo',
                payload: {peer: 'done'},
            })

            const ownerProjectionAfterDispatch = selectRequestProjectionV2(
                ownerRuntime,
                requestId,
            )
            expect(ownerProjectionAfterDispatch?.status).toBe('started')
            expect(ownerProjectionAfterDispatch?.pendingCommandCount).toBe(1)

            masterClient.send({
                type: 'command-dispatch',
                envelope: remoteDispatchEnvelope,
            })

            const relayedDispatch = await slaveClient.waitForMessage(message => {
                return message.type === 'command-dispatch'
                    && message.envelope.commandId === remoteDispatchEnvelope.commandId
            })

            expect(relayedDispatch.type).toBe('command-dispatch')
            if (relayedDispatch.type !== 'command-dispatch') {
                throw new Error('Expected relayed command dispatch')
            }

            const remoteHandleResult = await peerRuntime.handleRemoteDispatch(relayedDispatch.envelope)
            expect(remoteHandleResult.events).toHaveLength(3)

            const peerProjection = selectRequestProjectionV2(peerRuntime, requestId)
            expect(peerProjection).toBeUndefined()

            remoteHandleResult.events.forEach(event => {
                slaveClient.send({
                    type: 'command-event',
                    envelope: event,
                })
            })

            for (const expectedEventType of ['accepted', 'started', 'completed'] as const) {
                const relayedEvent = await masterClient.waitForMessage(message => {
                    return message.type === 'command-event'
                        && message.envelope.commandId === remoteDispatchEnvelope.commandId
                        && message.envelope.eventType === expectedEventType
                })

                expect(relayedEvent.type).toBe('command-event')
                if (relayedEvent.type !== 'command-event') {
                    throw new Error('Expected relayed command event')
                }

                ownerRuntime.applyRemoteCommandEvent(relayedEvent.envelope)
            }

            const ownerProjection = selectRequestProjectionV2(ownerRuntime, requestId)
            expect(ownerProjection?.status).toBe('complete')
            expect(ownerProjection?.pendingCommandCount).toBe(0)
            expect(ownerProjection?.resultsByCommand[remoteDispatchEnvelope.commandId]).toEqual({
                payload: {
                    peer: 'done',
                },
            })
            expect((ownerProjection?.mergedResults.payload as {peer?: string} | undefined)?.peer).toBe('done')
        } finally {
            await slaveClient.close()
            await masterClient.close()
        }
    })

    it('delivers request lifecycle snapshot during resume barrier before queued dispatch resumes', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterClient = await createTestWsClient(addressInfo.wsUrl)
        const slaveClient = await createTestWsClient(addressInfo.wsUrl)

        try {
            masterClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await masterClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(masterAck.type).toBe('node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }
            const sessionId = masterAck.ack.sessionId

            slaveClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            const slaveAck = await slaveClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(slaveAck.type).toBe('node-hello-ack')

            await slaveClient.close()
            await waitFor(() => {
                const session = server.host.hostRuntime.getSession(sessionId)
                const slaveNode = session?.nodes[slaveNodeId]
                return Boolean(slaveNode && slaveNode.connected === false)
            })

            const queuedDispatch: CommandDispatchEnvelope = {
                envelopeId: createEnvelopeId(),
                sessionId,
                requestId: createRequestId(),
                commandId: createCommandId(),
                ownerNodeId: masterNodeId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
                commandName: 'demo.command.after-resume',
                payload: {stage: 'queued-while-offline'},
                context: {},
                sentAt: Date.now(),
            }

            masterClient.send({
                type: 'command-dispatch',
                envelope: queuedDispatch,
            })

            const resumedSlaveClient = await createTestWsClient(addressInfo.wsUrl)
            try {
                resumedSlaveClient.send({
                    type: 'node-hello',
                    hello: createHello(ticket.token, createRuntimeInfo({
                        nodeId: slaveNodeId,
                        deviceId: 'slave-device',
                        role: 'slave',
                    })),
                })

                const resumedAck = await resumedSlaveClient.waitForMessage(message => message.type === 'node-hello-ack')
                expect(resumedAck.type).toBe('node-hello-ack')

                resumedSlaveClient.send({
                    type: 'resume-begin',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now(),
                })

                const lifecycleSnapshot: RequestLifecycleSnapshotEnvelope = {
                    envelopeId: createEnvelopeId(),
                    sessionId,
                    requestId: createRequestId(),
                    ownerNodeId: masterNodeId,
                    sourceNodeId: masterNodeId,
                    targetNodeId: slaveNodeId,
                    snapshot: {
                        requestId: createRequestId(),
                        ownerNodeId: masterNodeId,
                        rootCommandId: createCommandId(),
                        sessionId,
                        status: 'started',
                        startedAt: Date.now(),
                        updatedAt: Date.now(),
                        commands: [],
                        commandResults: [],
                    },
                    sentAt: Date.now(),
                }

                masterClient.send({
                    type: 'request-lifecycle-snapshot',
                    envelope: lifecycleSnapshot,
                })

                const snapshotMessage = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'request-lifecycle-snapshot'
                })

                expect(snapshotMessage.type).toBe('request-lifecycle-snapshot')
                if (snapshotMessage.type === 'request-lifecycle-snapshot') {
                    expect(snapshotMessage.envelope.snapshot.status).toBe('started')
                    expect(snapshotMessage.envelope.targetNodeId).toBe(slaveNodeId)
                }

                await expect(
                    resumedSlaveClient.waitForMessage(message => {
                        return message.type === 'command-dispatch'
                            && message.envelope.commandName === 'demo.command.after-resume'
                    }, 120),
                ).rejects.toThrow(/Timed out/)

                resumedSlaveClient.send({
                    type: 'resume-complete',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now() + 1,
                })

                const resumedDispatch = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'command-dispatch'
                        && message.envelope.commandName === 'demo.command.after-resume'
                })

                expect(resumedDispatch.type).toBe('command-dispatch')
                if (resumedDispatch.type === 'command-dispatch') {
                    expect(resumedDispatch.envelope.payload).toEqual({stage: 'queued-while-offline'})
                }
            } finally {
                await resumedSlaveClient.close()
            }
        } finally {
            await masterClient.close()
        }
    })

    it('allows runtime-shell peer to restore request projection from snapshot delivered over real ws resume flow', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

        const ownerRuntime = createDualTopologyHostTestRuntime({
            localNodeId: masterNodeId,
            loggerModuleName: 'mock.server.dual-topology-host.test.owner-runtime-v2',
            modules: [createEchoModuleV2()],
        })
        await ownerRuntime.start()

        const mirrorRuntime = createSilentRuntimeV2(slaveNodeId)
        await mirrorRuntime.start()

        const executionRequestId = createRequestId()
        const executionResult = await ownerRuntime.execute({
            commandName: 'mock.server.dual-topology-host.test.echo',
            payload: {value: 'from-owner-runtime'},
            requestId: executionRequestId,
        })

        expect(executionResult.status).toBe('COMPLETED')

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

        const masterClient = await createTestWsClient(addressInfo.wsUrl)
        const slaveClient = await createTestWsClient(addressInfo.wsUrl)

        try {
            masterClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await masterClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(masterAck.type).toBe('node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }
            const sessionId = masterAck.ack.sessionId

            slaveClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            const slaveAck = await slaveClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(slaveAck.type).toBe('node-hello-ack')

            await slaveClient.close()
            await waitFor(() => {
                const session = server.host.hostRuntime.getSession(sessionId)
                const slaveNode = session?.nodes[slaveNodeId]
                return Boolean(slaveNode && slaveNode.connected === false)
            })

            const resumedSlaveClient = await createTestWsClient(addressInfo.wsUrl)
            try {
                resumedSlaveClient.send({
                    type: 'node-hello',
                    hello: createHello(ticket.token, createRuntimeInfo({
                        nodeId: slaveNodeId,
                        deviceId: 'slave-device',
                        role: 'slave',
                    })),
                })

                const resumedAck = await resumedSlaveClient.waitForMessage(message => message.type === 'node-hello-ack')
                expect(resumedAck.type).toBe('node-hello-ack')

                resumedSlaveClient.send({
                    type: 'resume-begin',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now(),
                })

                const ownerSnapshot = ownerRuntime.exportRequestLifecycleSnapshot(executionRequestId, sessionId)
                if (!ownerSnapshot) {
                    throw new Error('Owner runtime did not export request lifecycle snapshot')
                }

                const lifecycleSnapshotEnvelope: RequestLifecycleSnapshotEnvelope = {
                    envelopeId: createEnvelopeId(),
                    sessionId,
                    requestId: executionRequestId,
                    ownerNodeId: masterNodeId,
                    sourceNodeId: masterNodeId,
                    targetNodeId: slaveNodeId,
                    snapshot: ownerSnapshot,
                    sentAt: Date.now(),
                }

                masterClient.send({
                    type: 'request-lifecycle-snapshot',
                    envelope: lifecycleSnapshotEnvelope,
                })

                const snapshotMessage = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'request-lifecycle-snapshot'
                })

                expect(snapshotMessage.type).toBe('request-lifecycle-snapshot')
                if (snapshotMessage.type !== 'request-lifecycle-snapshot') {
                    throw new Error('Expected request lifecycle snapshot message')
                }

                mirrorRuntime.applyRequestLifecycleSnapshot(snapshotMessage.envelope.snapshot)

                const mirroredProjection = selectRequestProjectionV2(
                    mirrorRuntime,
                    executionRequestId,
                )

                expect(mirroredProjection?.status).toBe('complete')
                expect(mirroredProjection?.mergedResults).toEqual({
                    payload: {
                        value: 'from-owner-runtime',
                    },
                })
                expect(mirroredProjection?.pendingCommandCount).toBe(0)

                resumedSlaveClient.send({
                    type: 'resume-complete',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now() + 1,
                })
            } finally {
                await resumedSlaveClient.close()
            }
        } finally {
            await masterClient.close()
        }
    })

    it('relays state sync summary, diff, and commit ack envelopes over real ws during resume barrier', async () => {
        const server = createDualTopologyHostServer({
            config: {
                port: 0,
                heartbeatIntervalMs: 50,
                heartbeatTimeoutMs: 5_000,
            },
        })
        servers.push(server)
        await server.start()

        const addressInfo = server.getAddressInfo()
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()

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

        const masterClient = await createTestWsClient(addressInfo.wsUrl)
        const slaveClient = await createTestWsClient(addressInfo.wsUrl)

        try {
            masterClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                })),
            })

            const masterAck = await masterClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(masterAck.type).toBe('node-hello-ack')
            if (masterAck.type !== 'node-hello-ack' || !masterAck.ack.sessionId) {
                throw new Error('Master hello ack missing sessionId')
            }
            const sessionId = masterAck.ack.sessionId

            slaveClient.send({
                type: 'node-hello',
                hello: createHello(ticket.token, createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                })),
            })

            const slaveAck = await slaveClient.waitForMessage(message => message.type === 'node-hello-ack')
            expect(slaveAck.type).toBe('node-hello-ack')

            await slaveClient.close()
            await waitFor(() => {
                const session = server.host.hostRuntime.getSession(sessionId)
                const slaveNode = session?.nodes[slaveNodeId]
                return Boolean(slaveNode && slaveNode.connected === false)
            })

            const resumedSlaveClient = await createTestWsClient(addressInfo.wsUrl)
            try {
                resumedSlaveClient.send({
                    type: 'node-hello',
                    hello: createHello(ticket.token, createRuntimeInfo({
                        nodeId: slaveNodeId,
                        deviceId: 'slave-device',
                        role: 'slave',
                    })),
                })

                const resumedAck = await resumedSlaveClient.waitForMessage(message => message.type === 'node-hello-ack')
                expect(resumedAck.type).toBe('node-hello-ack')

                resumedSlaveClient.send({
                    type: 'resume-begin',
                    sessionId,
                    nodeId: slaveNodeId,
                    timestamp: Date.now(),
                })

                const summaryEnvelope: StateSyncSummaryEnvelope = {
                    envelopeId: createEnvelopeId(),
                    sessionId,
                    sourceNodeId: masterNodeId,
                    targetNodeId: slaveNodeId,
                    direction: 'master-to-slave',
                    summaryBySlice: {
                        'mock.server.dual-topology-host.test.sync': {
                            A: {updatedAt: Date.now()},
                        },
                    },
                    sentAt: Date.now(),
                }

                const diffEnvelope: StateSyncDiffEnvelope = {
                    envelopeId: createEnvelopeId(),
                    sessionId,
                    sourceNodeId: masterNodeId,
                    targetNodeId: slaveNodeId,
                    direction: 'master-to-slave',
                    diffBySlice: {
                        'mock.server.dual-topology-host.test.sync': [
                            {
                                key: 'A',
                                value: {
                                    value: {ready: true},
                                    updatedAt: Date.now(),
                                },
                            },
                        ],
                    },
                    sentAt: Date.now(),
                }

                const commitAckEnvelope: StateSyncCommitAckEnvelope = {
                    envelopeId: createEnvelopeId(),
                    sessionId,
                    sourceNodeId: slaveNodeId,
                    targetNodeId: masterNodeId,
                    direction: 'slave-to-master',
                    committedAt: Date.now(),
                }

                masterClient.send({
                    type: 'state-sync-summary',
                    envelope: summaryEnvelope,
                })

                masterClient.send({
                    type: 'state-sync-diff',
                    envelope: diffEnvelope,
                })

                const relayedSummary = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'state-sync-summary'
                })
                expect(relayedSummary.type).toBe('state-sync-summary')
                if (relayedSummary.type === 'state-sync-summary') {
                    expect(relayedSummary.envelope.summaryBySlice).toEqual(summaryEnvelope.summaryBySlice)
                }

                const relayedDiff = await resumedSlaveClient.waitForMessage(message => {
                    return message.type === 'state-sync-diff'
                })
                expect(relayedDiff.type).toBe('state-sync-diff')
                if (relayedDiff.type === 'state-sync-diff') {
                    expect(relayedDiff.envelope.diffBySlice).toEqual(diffEnvelope.diffBySlice)
                }

                resumedSlaveClient.send({
                    type: 'state-sync-commit-ack',
                    envelope: commitAckEnvelope,
                })

                const relayedCommitAck = await masterClient.waitForMessage(message => {
                    return message.type === 'state-sync-commit-ack'
                })
                expect(relayedCommitAck.type).toBe('state-sync-commit-ack')
                if (relayedCommitAck.type === 'state-sync-commit-ack') {
                    expect(relayedCommitAck.envelope.committedAt).toBe(commitAckEnvelope.committedAt)
                    expect(relayedCommitAck.envelope.targetNodeId).toBe(masterNodeId)
                }
            } finally {
                await resumedSlaveClient.close()
            }
        } finally {
            await masterClient.close()
        }
    })
})
