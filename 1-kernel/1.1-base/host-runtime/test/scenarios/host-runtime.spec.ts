import {describe, expect, it} from 'vitest'
import {createLoggerPort} from '@impos2/kernel-base-platform-ports'
import {
    createCommandId,
    createEnvelopeId,
    createNodeId,
    createProjectionId,
    createRequestId,
    nowTimestampMs,
    type CommandDispatchEnvelope,
    type NodeHello,
    type NodeRuntimeInfo,
    type ProjectionMirrorEnvelope,
    type RequestLifecycleSnapshotEnvelope,
    type StateSyncCommitAckEnvelope,
    type StateSyncDiffEnvelope,
    type StateSyncSummaryEnvelope,
} from '@impos2/kernel-base-contracts'
import {
    createHostRuntime,
} from '../../src'

const createLogger = () => {
    return createLoggerPort({
        environmentMode: 'DEV',
        write: () => {},
        scope: {
            moduleName: 'kernel.base.host-runtime.test',
            layer: 'kernel',
        },
    })
}

const createRuntimeInfo = (input: {
    nodeId: string
    deviceId: string
    role: 'master' | 'slave'
    runtimeVersion?: string
    protocolVersion?: string
    capabilities?: string[]
}): NodeRuntimeInfo => {
    return {
        nodeId: input.nodeId as any,
        deviceId: input.deviceId,
        role: input.role,
        platform: 'android',
        product: 'new-pos',
        assemblyAppId: 'assembly.app',
        assemblyVersion: '1.0.0',
        buildNumber: 1,
        bundleVersion: '1',
        runtimeVersion: input.runtimeVersion ?? '1.0.0',
        protocolVersion: input.protocolVersion ?? '2026.04',
        capabilities: [...(input.capabilities ?? ['projection-mirror', 'dispatch-relay'])],
    }
}

const createHello = (input: {
    ticketToken: string
    runtime: NodeRuntimeInfo
    helloId?: string
    sentAt?: number
}): NodeHello => {
    return {
        helloId: input.helloId ?? `hello_${input.runtime.nodeId}`,
        ticketToken: input.ticketToken,
        runtime: input.runtime,
        sentAt: input.sentAt ?? nowTimestampMs(),
    }
}

const createDispatchEnvelope = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
}): CommandDispatchEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        requestId: createRequestId(),
        commandId: createCommandId(),
        ownerNodeId: input.sourceNodeId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        commandName: 'demo.command',
        payload: {ok: true},
        context: {},
        sentAt: nowTimestampMs(),
    }
}

const createProjectionEnvelope = (input: {
    sessionId: string
    ownerNodeId: string
}): ProjectionMirrorEnvelope => {
    const requestId = createRequestId()
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        ownerNodeId: input.ownerNodeId as any,
        projection: {
            projectionId: createProjectionId(),
            requestId,
            ownerNodeId: input.ownerNodeId as any,
            status: 'started',
            startedAt: nowTimestampMs(),
            updatedAt: nowTimestampMs(),
            resultsByCommand: {},
            mergedResults: {},
            errorsByCommand: {},
            pendingCommandCount: 1,
        },
        mirroredAt: nowTimestampMs(),
    }
}

const createRequestLifecycleSnapshotEnvelope = (input: {
    sessionId: string
    ownerNodeId: string
    sourceNodeId: string
    targetNodeId: string
}): RequestLifecycleSnapshotEnvelope => {
    const requestId = createRequestId()
    const rootCommandId = createCommandId()
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        requestId,
        ownerNodeId: input.ownerNodeId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        snapshot: {
            requestId,
            ownerNodeId: input.ownerNodeId as any,
            rootCommandId,
            sessionId: input.sessionId as any,
            status: 'started',
            startedAt: nowTimestampMs(),
            updatedAt: nowTimestampMs(),
            commands: [
                {
                    commandId: rootCommandId,
                    ownerNodeId: input.ownerNodeId as any,
                    sourceNodeId: input.sourceNodeId as any,
                    targetNodeId: input.sourceNodeId as any,
                    commandName: 'demo.command.resume.snapshot',
                    status: 'started',
                    updatedAt: nowTimestampMs(),
                },
            ],
            commandResults: [],
        },
        sentAt: nowTimestampMs(),
    }
}

const createStateSyncSummaryEnvelope = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
}): StateSyncSummaryEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        direction: 'master-to-slave',
        summaryBySlice: {
            'kernel.base.host-runtime.test.sync': {
                A: {updatedAt: 10 as any},
            },
        },
        sentAt: nowTimestampMs(),
    }
}

const createStateSyncDiffEnvelope = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
}): StateSyncDiffEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        direction: 'master-to-slave',
        diffBySlice: {
            'kernel.base.host-runtime.test.sync': [
                {
                    key: 'A',
                    value: {
                        value: 'ready',
                        updatedAt: 20 as any,
                    },
                },
            ],
        },
        sentAt: nowTimestampMs(),
    }
}

const createStateSyncCommitAckEnvelope = (input: {
    sessionId: string
    sourceNodeId: string
    targetNodeId: string
}): StateSyncCommitAckEnvelope => {
    return {
        envelopeId: createEnvelopeId(),
        sessionId: input.sessionId as any,
        sourceNodeId: input.sourceNodeId as any,
        targetNodeId: input.targetNodeId as any,
        committedAt: nowTimestampMs(),
    }
}

describe('host-runtime', () => {
    it('issues tickets, accepts hello, and creates a session with peer runtime acknowledgement', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
                capabilities: ['projection-mirror', 'dispatch-relay', 'host-observe'],
            }),
            logger: createLogger(),
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const masterHello = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })

        expect(masterHello.ack.accepted).toBe(true)
        expect(masterHello.ack.sessionId).toBeDefined()
        expect(masterHello.ack.peerRuntime).toBeUndefined()
        expect(masterHello.session?.status).toBe('awaiting-peer')

        const slaveHello = runtime.processHello({
            connectionId: 'conn-slave' as any,
            receivedAt: 3_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                }),
            }),
        })

        expect(slaveHello.ack.accepted).toBe(true)
        expect(slaveHello.ack.sessionId).toBe(masterHello.ack.sessionId)
        expect(slaveHello.ack.peerRuntime?.nodeId).toBe(masterNodeId)

        const session = runtime.getSession(masterHello.ack.sessionId!)
        expect(session?.status).toBe('active')
        expect(Object.keys(session?.nodes ?? {})).toHaveLength(2)

        const snapshot = runtime.getSnapshot()
        expect(snapshot.tickets).toHaveLength(1)
        expect(snapshot.sessions).toHaveLength(1)
        expect(snapshot.recentEvents.some(event => event.event === 'accepted')).toBe(true)
    })

    it('rejects hello when required capabilities are missing', () => {
        const masterNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
            requiredCapabilities: ['projection-mirror', 'dispatch-relay', 'request-sync'],
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const result = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                    capabilities: ['projection-mirror'],
                }),
            }),
        })

        expect(result.ack.accepted).toBe(false)
        expect(result.ack.rejectionCode).toBe('CAPABILITY_MISSING')
        expect(result.session).toBeUndefined()
    })

    it('requires explicit resume completion before reconnected peer can drain queued relay', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const masterHello = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })
        const sessionId = masterHello.ack.sessionId!

        runtime.processHello({
            connectionId: 'conn-slave' as any,
            receivedAt: 3_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                }),
            }),
        })

        runtime.detachConnection({
            connectionId: 'conn-slave' as any,
            disconnectedAt: 4_000,
            reason: 'manual-test-disconnect',
        })

        const relayResult = runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 5_000,
            envelope: createDispatchEnvelope({
                sessionId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })

        expect(relayResult.queuedForOfflinePeer).toBe(true)
        expect(relayResult.deliveries).toHaveLength(1)

        const pendingBeforeReconnect = runtime.getSession(sessionId)
        expect(pendingBeforeReconnect?.relayPendingCount).toBe(1)
        expect(pendingBeforeReconnect?.status).toBe('resume-required')

        runtime.attachConnection({
            sessionId,
            nodeId: slaveNodeId,
            connectionId: 'conn-slave-2' as any,
            connectedAt: 6_000,
        })

        const blockedDrain = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_000)
        expect(blockedDrain).toHaveLength(0)
        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(1)
        expect(runtime.getSession(sessionId)?.status).toBe('resume-required')

        runtime.beginResume({
            sessionId,
            nodeId: slaveNodeId,
            startedAt: 6_100,
        })
        expect(runtime.getSession(sessionId)?.status).toBe('resyncing')

        runtime.completeResume({
            sessionId,
            nodeId: slaveNodeId,
            completedAt: 6_200,
        })

        const drained = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_200)
        expect(drained).toHaveLength(1)
        expect(drained[0].targetNodeId).toBe(slaveNodeId)
        expect(drained[0].connectionId).toBe('conn-slave-2')
        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(0)
        expect(runtime.getSession(sessionId)?.status).toBe('active')
    })

    it('allows request lifecycle snapshot relay during resume barrier while keeping dispatch blocked', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const masterHello = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })
        const sessionId = masterHello.ack.sessionId!

        runtime.processHello({
            connectionId: 'conn-slave' as any,
            receivedAt: 3_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                }),
            }),
        })

        runtime.detachConnection({
            connectionId: 'conn-slave' as any,
            disconnectedAt: 4_000,
            reason: 'manual-test-disconnect',
        })

        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 5_000,
            envelope: createDispatchEnvelope({
                sessionId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })

        runtime.attachConnection({
            sessionId,
            nodeId: slaveNodeId,
            connectionId: 'conn-slave-2' as any,
            connectedAt: 6_000,
        })

        runtime.beginResume({
            sessionId,
            nodeId: slaveNodeId,
            startedAt: 6_100,
        })

        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 6_150,
            envelope: createRequestLifecycleSnapshotEnvelope({
                sessionId,
                ownerNodeId: masterNodeId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })

        const drainedDuringResume = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_200)
        expect(drainedDuringResume).toHaveLength(1)
        expect(drainedDuringResume[0].channel).toBe('resume')
        expect('snapshot' in drainedDuringResume[0].envelope).toBe(true)
        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(1)

        runtime.completeResume({
            sessionId,
            nodeId: slaveNodeId,
            completedAt: 6_300,
        })

        const drainedAfterResume = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_300)
        expect(drainedAfterResume).toHaveLength(1)
        expect(drainedAfterResume[0].channel).toBe('dispatch')
        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(0)
        expect(runtime.getSession(sessionId)?.status).toBe('active')
    })

    it('updates heartbeat and expires idle connections by timeout', () => {
        const masterNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
            heartbeatTimeoutMs: 1_000,
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const hello = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })

        const sessionId = hello.ack.sessionId!
        runtime.recordHeartbeat('conn-master' as any, 2_700)
        expect(runtime.getSnapshot().recentEvents.some(event => event.event === 'heartbeat')).toBe(true)

        const detachedTooEarly = runtime.expireIdleConnections({
            now: 3_500,
        })
        expect(detachedTooEarly).toHaveLength(0)

        const detached = runtime.expireIdleConnections({
            now: 3_801,
        })
        expect(detached).toHaveLength(1)
        expect(detached[0].sessionId).toBe(sessionId)
        expect(runtime.getSession(sessionId)?.nodes[masterNodeId]?.connected).toBe(false)
    })

    it('routes projection mirror envelopes to the owner node connection', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })
        const slaveHello = runtime.processHello({
            connectionId: 'conn-slave' as any,
            receivedAt: 3_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                }),
            }),
        })

        const result = runtime.relayEnvelope({
            sessionId: slaveHello.ack.sessionId!,
            sourceNodeId: slaveNodeId,
            relayedAt: 4_000,
            envelope: createProjectionEnvelope({
                sessionId: slaveHello.ack.sessionId!,
                ownerNodeId: masterNodeId,
            }),
        })

        expect(result.channel).toBe('projection')
        expect(result.queuedForOfflinePeer).toBe(false)

        const drained = runtime.drainConnectionOutbox('conn-master' as any, 4_000)
        expect(drained).toHaveLength(1)
        expect(drained[0].targetNodeId).toBe(masterNodeId)
        expect(drained[0].channel).toBe('projection')
    })

    it('treats state sync envelopes as resume traffic so they pass during resume barrier', () => {
        const masterNodeId = createNodeId()
        const slaveNodeId = createNodeId()
        const runtime = createHostRuntime({
            hostRuntime: createRuntimeInfo({
                nodeId: createNodeId(),
                deviceId: 'host',
                role: 'master',
            }),
            logger: createLogger(),
        })

        const ticket = runtime.issueTicket({
            masterNodeId,
            transportUrls: ['ws://127.0.0.1:8080/dual'],
            expiresInMs: 30_000,
            issuedAt: 1_000,
        })

        const masterHello = runtime.processHello({
            connectionId: 'conn-master' as any,
            receivedAt: 2_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: masterNodeId,
                    deviceId: 'master-device',
                    role: 'master',
                }),
            }),
        })
        const sessionId = masterHello.ack.sessionId!

        runtime.processHello({
            connectionId: 'conn-slave' as any,
            receivedAt: 3_000,
            hello: createHello({
                ticketToken: ticket.ticket.token,
                runtime: createRuntimeInfo({
                    nodeId: slaveNodeId,
                    deviceId: 'slave-device',
                    role: 'slave',
                }),
            }),
        })

        runtime.detachConnection({
            connectionId: 'conn-slave' as any,
            disconnectedAt: 4_000,
            reason: 'manual-test-disconnect',
        })

        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 5_000,
            envelope: createDispatchEnvelope({
                sessionId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })

        runtime.attachConnection({
            sessionId,
            nodeId: slaveNodeId,
            connectionId: 'conn-slave-2' as any,
            connectedAt: 6_000,
        })
        runtime.beginResume({
            sessionId,
            nodeId: slaveNodeId,
            startedAt: 6_100,
        })

        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 6_150,
            envelope: createStateSyncSummaryEnvelope({
                sessionId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })
        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: masterNodeId,
            relayedAt: 6_160,
            envelope: createStateSyncDiffEnvelope({
                sessionId,
                sourceNodeId: masterNodeId,
                targetNodeId: slaveNodeId,
            }),
        })
        runtime.relayEnvelope({
            sessionId,
            sourceNodeId: slaveNodeId,
            relayedAt: 6_170,
            envelope: createStateSyncCommitAckEnvelope({
                sessionId,
                sourceNodeId: slaveNodeId,
                targetNodeId: masterNodeId,
            }),
        })

        const drainedSlaveDuringResume = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_200)
        expect(drainedSlaveDuringResume).toHaveLength(2)
        expect(drainedSlaveDuringResume.map(delivery => delivery.channel)).toEqual(['resume', 'resume'])
        expect('summaryBySlice' in drainedSlaveDuringResume[0].envelope).toBe(true)
        expect('diffBySlice' in drainedSlaveDuringResume[1].envelope).toBe(true)

        const drainedMasterDuringResume = runtime.drainConnectionOutbox('conn-master' as any, 6_200)
        expect(drainedMasterDuringResume).toHaveLength(1)
        expect(drainedMasterDuringResume[0].channel).toBe('resume')
        expect('committedAt' in drainedMasterDuringResume[0].envelope).toBe(true)

        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(1)

        runtime.completeResume({
            sessionId,
            nodeId: slaveNodeId,
            completedAt: 6_300,
        })

        const drainedAfterResume = runtime.drainConnectionOutbox('conn-slave-2' as any, 6_300)
        expect(drainedAfterResume).toHaveLength(1)
        expect(drainedAfterResume[0].channel).toBe('dispatch')
        expect(runtime.getSession(sessionId)?.relayPendingCount).toBe(0)
    })
})
