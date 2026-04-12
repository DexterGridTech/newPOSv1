import {
    type ConnectionId,
    nowTimestampMs,
    type NodeHelloAck,
    type NodeId,
    type PairingTicket,
} from '@impos2/kernel-base-contracts'
import {createHostFaultRegistry} from './faults'
import {createHostConnectionId, createHostSessionId} from './ids'
import {createHostObservability} from './observability'
import {createRelayRegistry} from './relay'
import {createSessionRegistry} from './sessions'
import {createTicketRegistry} from './tickets'
import {evaluateHostCompatibility} from './compatibility'
import {hostRuntimeParameterDefinitions} from '../supports'
import type {
    AttachHostConnectionInput,
    BeginHostResumeInput,
    CompleteHostResumeInput,
    CreateHostRuntimeInput,
    DetachHostConnectionInput,
    ExpireHostConnectionsInput,
    HostHelloResult,
    HostRuntime,
    IssueHostTicketInput,
    ProcessHostHelloInput,
    RelayHostEnvelopeInput,
} from '../types/host'
import type {HostRelayChannel, HostRelayEnvelope, HostRelayResult} from '../types/relay'

const createAck = (
    helloId: string,
    input: Omit<NodeHelloAck, 'helloId' | 'hostTime'> & {hostTime: number},
): NodeHelloAck => {
    return {
        helloId,
        accepted: input.accepted,
        sessionId: input.sessionId,
        peerRuntime: input.peerRuntime,
        compatibility: input.compatibility,
        rejectionCode: input.rejectionCode,
        rejectionMessage: input.rejectionMessage,
        hostTime: input.hostTime,
    }
}

const resolveRelayChannel = (envelope: HostRelayEnvelope): HostRelayChannel => {
    if ('commandName' in envelope) {
        return 'dispatch'
    }
    if ('projection' in envelope) {
        return 'projection'
    }
    if ('snapshot' in envelope || 'summaryBySlice' in envelope || 'diffBySlice' in envelope || 'committedAt' in envelope || 'timestamp' in envelope) {
        return 'resume'
    }
    return 'event'
}

const resolveRelayTargetNodeId = (envelope: HostRelayEnvelope): NodeId => {
    if ('targetNodeId' in envelope) {
        return envelope.targetNodeId
    }
    if ('ownerNodeId' in envelope) {
        return envelope.ownerNodeId
    }
    throw new Error('cannot resolve relay target node')
}

export const createHostRuntime = (
    input: CreateHostRuntimeInput,
): HostRuntime => {
    const logger = input.logger.scope({
        subsystem: 'host-runtime',
        component: 'HostRuntime',
    })
    const tickets = createTicketRegistry()
    const sessions = createSessionRegistry()
    const relay = createRelayRegistry()
    const faults = createHostFaultRegistry()
    const observability = createHostObservability({
        logger,
        maxEvents: input.maxObservationEvents ?? hostRuntimeParameterDefinitions.maxObservationEvents.defaultValue,
    })

    const heartbeatTimeoutMs =
        input.heartbeatTimeoutMs ?? hostRuntimeParameterDefinitions.heartbeatTimeoutMs.defaultValue

    const syncPendingCount = (sessionId: string, updatedAt: number) => {
        sessions.updateRelayPending(sessionId as any, relay.pendingCount(sessionId as any), updatedAt)
    }

    const issueTicket = (ticketInput: IssueHostTicketInput) => {
        const issuedAt = ticketInput.issuedAt ?? nowTimestampMs()
        const ticket: PairingTicket = {
            token: `ticket_${Math.random().toString(36).slice(2, 12)}`,
            masterNodeId: ticketInput.masterNodeId,
            transportUrls: [...ticketInput.transportUrls],
            issuedAt,
            expiresAt: issuedAt + ticketInput.expiresInMs,
            hostRuntime: input.hostRuntime,
        }

        const record = tickets.issue(ticket)
        observability.record({
            level: 'info',
            category: 'host.ticket',
            event: 'issued',
            nodeId: ticket.masterNodeId,
            data: {
                token: ticket.token,
                expiresAt: ticket.expiresAt,
                transportUrls: ticket.transportUrls,
            },
        })
        return record
    }

    const attachConnection = (attachInput: AttachHostConnectionInput) => {
        const connectedAt = attachInput.connectedAt ?? nowTimestampMs()
        const result = sessions.attachConnection({
            sessionId: attachInput.sessionId,
            nodeId: attachInput.nodeId,
            connectionId: attachInput.connectionId ?? createHostConnectionId(),
            connectedAt,
        })

        observability.record({
            level: 'info',
            category: 'host.connection',
            event: 'attached',
            sessionId: result.sessionId,
            nodeId: result.nodeId,
            connectionId: result.connectionId,
            data: {
                replacedConnectionId: result.replacedConnectionId,
            },
        })

        const reboundDeliveries = relay.rebindConnection({
            sessionId: result.sessionId,
            targetNodeId: result.nodeId,
            connectionId: result.connectionId,
        })

        if (reboundDeliveries.length > 0) {
            syncPendingCount(result.sessionId, connectedAt)
            observability.record({
                level: 'info',
                category: 'host.relay',
                event: 'rebound',
                sessionId: result.sessionId,
                nodeId: result.nodeId,
                connectionId: result.connectionId,
                data: {
                    queuedCount: reboundDeliveries.length,
                },
            })
        }

        return result
    }

    const detachConnection = (detachInput: DetachHostConnectionInput) => {
        const result = sessions.detachConnection({
            connectionId: detachInput.connectionId,
            sessionId: detachInput.sessionId,
            nodeId: detachInput.nodeId,
            reason: detachInput.reason,
            disconnectedAt: detachInput.disconnectedAt ?? nowTimestampMs(),
        })

        if (result) {
            observability.record({
                level: 'warn',
                category: 'host.connection',
                event: 'detached',
                sessionId: result.sessionId,
                nodeId: result.nodeId,
                connectionId: result.connectionId,
                message: result.reason,
            })
        }

        return result
    }

    const beginResume = (resumeInput: BeginHostResumeInput) => {
        const startedAt = resumeInput.startedAt ?? nowTimestampMs()
        const session = sessions.beginResume({
            sessionId: resumeInput.sessionId,
            nodeId: resumeInput.nodeId,
            startedAt,
        })

        observability.record({
            level: 'info',
            category: 'host.resume',
            event: 'started',
            sessionId: session.sessionId,
            nodeId: resumeInput.nodeId,
            data: {
                pendingNodeIds: session.resume.pendingNodeIds,
            },
        })

        return session
    }

    const completeResume = (resumeInput: CompleteHostResumeInput) => {
        const completedAt = resumeInput.completedAt ?? nowTimestampMs()
        const session = sessions.completeResume({
            sessionId: resumeInput.sessionId,
            nodeId: resumeInput.nodeId,
            completedAt,
        })

        observability.record({
            level: 'info',
            category: 'host.resume',
            event: session.resume.phase === 'idle' ? 'completed' : 'partial-complete',
            sessionId: session.sessionId,
            nodeId: resumeInput.nodeId,
            data: {
                pendingNodeIds: session.resume.pendingNodeIds,
            },
        })

        return session
    }

    const buildRejectedHello = (
        helloInput: ProcessHostHelloInput,
        hostTime: number,
        rejectionCode: NonNullable<NodeHelloAck['rejectionCode']>,
        rejectionMessage: string,
        faultRuleIds: readonly string[],
    ): HostHelloResult => {
        const compatibility = {
            level: 'rejected' as const,
            reasons: [rejectionMessage],
            enabledCapabilities: [],
            disabledCapabilities: [...helloInput.hello.runtime.capabilities],
        }

        const ack = createAck(helloInput.hello.helloId, {
            accepted: false,
            compatibility,
            rejectionCode,
            rejectionMessage,
            hostTime,
        })

        observability.record({
            level: 'warn',
            category: 'host.hello',
            event: 'rejected',
            nodeId: helloInput.hello.runtime.nodeId,
            data: {
                rejectionCode,
                rejectionMessage,
                token: helloInput.hello.ticketToken,
                faultRuleIds,
            },
        })

        return {
            ack,
            effect: {
                faultRuleIds,
            },
        }
    }

    const processHello = (helloInput: ProcessHostHelloInput): HostHelloResult => {
        const receivedAt = helloInput.receivedAt ?? nowTimestampMs()
        const ticketRecord = tickets.get(helloInput.hello.ticketToken)
        if (!ticketRecord) {
            return buildRejectedHello(
                helloInput,
                receivedAt,
                'TOKEN_INVALID',
                'pairing ticket not found',
                [],
            )
        }

        if (ticketRecord.ticket.expiresAt < receivedAt) {
            return buildRejectedHello(
                helloInput,
                receivedAt,
                'TOKEN_EXPIRED',
                'pairing ticket expired',
                [],
            )
        }

        const helloFault = faults.matchHello({
            sessionId: ticketRecord.sessionId,
            sourceNodeId: helloInput.hello.runtime.nodeId,
            targetRole: helloInput.hello.runtime.role,
        })

        if (helloFault.rejection) {
            return buildRejectedHello(
                helloInput,
                receivedAt,
                helloFault.rejection.code,
                helloFault.rejection.message ?? 'hello rejected by fault rule',
                helloFault.ruleIds,
            )
        }

        if (
            helloInput.hello.runtime.role === 'master' &&
            helloInput.hello.runtime.nodeId !== ticketRecord.ticket.masterNodeId
        ) {
            return buildRejectedHello(
                helloInput,
                receivedAt,
                'ROLE_CONFLICT',
                'master node does not match ticket owner',
                helloFault.ruleIds,
            )
        }

        const occupied = ticketRecord.occupiedRoles[helloInput.hello.runtime.role]
        if (occupied && occupied.nodeId !== helloInput.hello.runtime.nodeId) {
            return buildRejectedHello(
                helloInput,
                receivedAt,
                'PAIR_OCCUPIED',
                `${helloInput.hello.runtime.role} already occupied`,
                helloFault.ruleIds,
            )
        }

        const compatibility = evaluateHostCompatibility({
            hostRuntime: input.hostRuntime,
            peerRuntime: helloInput.hello.runtime,
            requiredCapabilities: input.requiredCapabilities,
        })

        if (compatibility.level === 'rejected') {
            const reason = compatibility.reasons[0] ?? 'protocol incompatible'
            return buildRejectedHello(
                helloInput,
                receivedAt,
                reason.includes('capability') ? 'CAPABILITY_MISSING' : 'PROTOCOL_INCOMPATIBLE',
                reason,
                helloFault.ruleIds,
            )
        }

        const existingSession = ticketRecord.sessionId
            ? sessions.get(ticketRecord.sessionId)
            : undefined
        const session = existingSession
            ? sessions.updateHello({
                sessionId: existingSession.sessionId,
                runtime: helloInput.hello.runtime,
                compatibility,
                occurredAt: receivedAt,
            })
            : sessions.create({
                sessionId: createHostSessionId(),
                ticket: ticketRecord.ticket,
                nodeRuntime: helloInput.hello.runtime,
                compatibility,
                createdAt: receivedAt,
            })

        tickets.bindSession(ticketRecord.ticket.token, session.sessionId, receivedAt)
        tickets.occupy(
            ticketRecord.ticket.token,
            {
                role: helloInput.hello.runtime.role,
                nodeId: helloInput.hello.runtime.nodeId,
                sessionId: session.sessionId,
                connected: false,
                updatedAt: receivedAt,
            },
            receivedAt,
        )

        const peerRuntime = Object.values(session.nodes).find(node => {
            return node.nodeId !== helloInput.hello.runtime.nodeId
        })?.runtime

        const ack = createAck(helloInput.hello.helloId, {
            accepted: true,
            sessionId: session.sessionId,
            peerRuntime,
            compatibility,
            hostTime: receivedAt,
        })

        const connection = attachConnection({
            sessionId: session.sessionId,
            nodeId: helloInput.hello.runtime.nodeId,
            connectionId: helloInput.connectionId,
            connectedAt: receivedAt,
        })

        tickets.occupy(
            ticketRecord.ticket.token,
            {
                role: helloInput.hello.runtime.role,
                nodeId: helloInput.hello.runtime.nodeId,
                sessionId: session.sessionId,
                connected: true,
                updatedAt: receivedAt,
            },
            receivedAt,
        )

        observability.record({
            level: compatibility.level === 'degraded' ? 'warn' : 'info',
            category: 'host.hello',
            event: 'accepted',
            sessionId: session.sessionId,
            nodeId: helloInput.hello.runtime.nodeId,
            connectionId: connection.connectionId,
            data: {
                compatibilityLevel: compatibility.level,
                reasons: compatibility.reasons,
                faultRuleIds: helloFault.ruleIds,
            },
        })

        return {
            ack,
            session: sessions.get(session.sessionId),
            connection,
            effect: {
                ackDeliverAfterMs: helloFault.delayMs,
                faultRuleIds: helloFault.ruleIds,
            },
        }
    }

    const relayEnvelope = (relayInput: RelayHostEnvelopeInput): HostRelayResult => {
        const channel = resolveRelayChannel(relayInput.envelope)
        const targetNodeId = resolveRelayTargetNodeId(relayInput.envelope)
        const session = sessions.get(relayInput.sessionId)
        if (!session) {
            throw new Error(`session not found: ${relayInput.sessionId}`)
        }
        const targetNode = session.nodes[targetNodeId]
        if (!targetNode) {
            throw new Error(`target node not found: ${targetNodeId}`)
        }

        const relayedAt = relayInput.relayedAt ?? nowTimestampMs()
        const fault = faults.matchRelay({
            sessionId: relayInput.sessionId,
            sourceNodeId: relayInput.sourceNodeId,
            targetNodeId,
            targetRole: targetNode.role,
            channel,
        })

        const disconnectedConnectionIds: ConnectionId[] = []
        if (fault.disconnectTarget && targetNode.connectionId) {
            relay.markDisconnected()
            disconnectedConnectionIds.push(targetNode.connectionId)
            detachConnection({
                connectionId: targetNode.connectionId,
                reason: 'fault:relay-disconnect-target',
                disconnectedAt: relayedAt,
            })
        }

        if (fault.dropCurrentRelay) {
            relay.markDropped()
            observability.record({
                level: 'warn',
                category: 'host.relay',
                event: 'dropped',
                sessionId: relayInput.sessionId,
                nodeId: targetNodeId as any,
                data: {
                    channel,
                    faultRuleIds: fault.ruleIds,
                },
            })
            return {
                channel,
                deliveries: [],
                queuedForOfflinePeer: false,
                dropped: true,
                disconnectedConnectionIds,
                effect: {
                    delayMs: fault.delayMs,
                    faultRuleIds: fault.ruleIds,
                },
            }
        }

        if (!targetNode.connectionId) {
            const delivery = relay.enqueueOffline({
                sessionId: relayInput.sessionId,
                channel,
                sourceNodeId: relayInput.sourceNodeId,
                targetNodeId,
                envelope: relayInput.envelope,
                availableAt: relayedAt + (fault.delayMs ?? 0),
            })
            syncPendingCount(relayInput.sessionId, relayedAt)
            observability.record({
                level: 'warn',
                category: 'host.relay',
                event: 'peer-offline',
                sessionId: relayInput.sessionId,
                nodeId: targetNodeId as any,
                data: {
                    channel,
                    faultRuleIds: fault.ruleIds,
                },
            })
            return {
                channel,
                deliveries: [delivery],
                queuedForOfflinePeer: true,
                dropped: false,
                disconnectedConnectionIds,
                effect: {
                    delayMs: fault.delayMs,
                    faultRuleIds: fault.ruleIds,
                },
            }
        }

        const delivery = relay.enqueue({
            sessionId: relayInput.sessionId,
            channel,
            sourceNodeId: relayInput.sourceNodeId,
            targetNodeId,
            connectionId: targetNode.connectionId,
            envelope: relayInput.envelope,
            availableAt: relayedAt + (fault.delayMs ?? 0),
        })

        syncPendingCount(relayInput.sessionId, relayedAt)

        observability.record({
            level: 'info',
            category: 'host.relay',
            event: 'enqueued',
            sessionId: relayInput.sessionId,
            nodeId: targetNodeId as any,
            connectionId: targetNode.connectionId,
            data: {
                channel,
                sequence: delivery.sequence,
                delayMs: fault.delayMs,
                faultRuleIds: fault.ruleIds,
            },
        })

        return {
            channel,
            deliveries: [delivery],
            queuedForOfflinePeer: false,
            dropped: false,
            disconnectedConnectionIds,
            effect: {
                delayMs: fault.delayMs,
                faultRuleIds: fault.ruleIds,
            },
        }
    }

    return {
        issueTicket,
        processHello,
        attachConnection,
        detachConnection,
        beginResume,
        completeResume,
        recordHeartbeat(connectionId, occurredAt) {
            const when = occurredAt ?? nowTimestampMs()
            const connection = sessions.markHeartbeat({
                connectionId,
                occurredAt: when,
            })
            if (connection) {
                observability.record({
                    level: 'debug',
                    category: 'host.connection',
                    event: 'heartbeat',
                    sessionId: connection.sessionId,
                    nodeId: connection.nodeId,
                    connectionId: connection.connectionId,
                })
            }
        },
        expireIdleConnections(expireInput: ExpireHostConnectionsInput = {}) {
            const now = expireInput.now ?? nowTimestampMs()
            const timeoutMs = expireInput.timeoutMs ?? heartbeatTimeoutMs
            return sessions
                .listConnections()
                .filter(connection => now - connection.lastHeartbeatAt > timeoutMs)
                .map(connection => detachConnection({
                    connectionId: connection.connectionId,
                    reason: 'heartbeat-timeout',
                    disconnectedAt: now,
                }))
                .filter(Boolean) as any
        },
        relayEnvelope,
        drainConnectionOutbox(connectionId, now = nowTimestampMs()) {
            const connection = sessions.findConnection(connectionId)
            const session = connection ? sessions.get(connection.sessionId) : undefined
            if (session && session.resume.phase !== 'idle') {
                const resumeDeliveries = relay.drain(connectionId, now, ['resume'])
                if (resumeDeliveries.length === 0) {
                    return []
                }

                resumeDeliveries.forEach(delivery => {
                    syncPendingCount(delivery.sessionId, now)
                    observability.record({
                        level: 'info',
                        category: 'host.relay',
                        event: 'resume-flushed',
                        sessionId: delivery.sessionId,
                        nodeId: delivery.targetNodeId,
                        connectionId,
                        data: {
                            channel: delivery.channel,
                            sequence: delivery.sequence,
                        },
                    })
                })

                return resumeDeliveries
            }
            const deliveries = relay.drain(connectionId, now)
            deliveries.forEach(delivery => {
                syncPendingCount(delivery.sessionId, now)
                observability.record({
                    level: 'info',
                    category: 'host.relay',
                    event: 'flushed',
                    sessionId: delivery.sessionId,
                    nodeId: delivery.targetNodeId,
                    connectionId,
                    data: {
                        channel: delivery.channel,
                        sequence: delivery.sequence,
                    },
                })
            })
            return deliveries
        },
        addFaultRule(rule) {
            faults.addRule(rule)
        },
        replaceFaultRules(rules) {
            faults.replaceRules(rules)
        },
        clearFaultRules() {
            faults.clear()
        },
        listFaultRules() {
            return faults.list()
        },
        getTicket(token) {
            return tickets.get(token)
        },
        getSession(sessionId) {
            return sessions.get(sessionId)
        },
        getSnapshot() {
            return {
                hostRuntime: input.hostRuntime,
                tickets: tickets.list(),
                sessions: sessions.list(),
                relayCounters: relay.snapshotCounters(),
                activeFaultRules: faults.list(),
                recentEvents: observability.list(),
            }
        },
    }
}
