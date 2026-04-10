import type {
    CompatibilityDecision,
    ConnectionId,
    NodeRuntimeInfo,
    PairingTicket,
    SessionId,
} from '@impos2/kernel-base-contracts'
import type {
    HostConnectionAttachResult,
    HostConnectionDetachResult,
    HostConnectionRecord,
    HostSessionNodeRecord,
    HostSessionRecord,
} from '../types/session'

export interface SessionRegistry {
    create(input: {
        sessionId: SessionId
        ticket: PairingTicket
        nodeRuntime: NodeRuntimeInfo
        compatibility: CompatibilityDecision
        createdAt: number
    }): HostSessionRecord
    get(sessionId: SessionId): HostSessionRecord | undefined
    getByToken(token: string): HostSessionRecord | undefined
    attachConnection(input: {
        sessionId: SessionId
        nodeId: string
        connectionId: ConnectionId
        connectedAt: number
    }): HostConnectionAttachResult
    detachConnection(input: {
        connectionId?: ConnectionId
        sessionId?: SessionId
        nodeId?: string
        reason?: string
        disconnectedAt: number
    }): HostConnectionDetachResult | undefined
    beginResume(input: {
        sessionId: SessionId
        nodeId: string
        startedAt: number
    }): HostSessionRecord
    completeResume(input: {
        sessionId: SessionId
        nodeId: string
        completedAt: number
    }): HostSessionRecord
    markHeartbeat(input: {
        connectionId: ConnectionId
        occurredAt: number
    }): HostConnectionRecord | undefined
    updateHello(input: {
        sessionId: SessionId
        runtime: NodeRuntimeInfo
        compatibility: CompatibilityDecision
        occurredAt: number
    }): HostSessionRecord
    updateRelayPending(sessionId: SessionId, pendingCount: number, updatedAt: number): void
    list(): readonly HostSessionRecord[]
    findConnection(connectionId: ConnectionId): HostConnectionRecord | undefined
    listConnections(): readonly HostConnectionRecord[]
}

const cloneNode = (node: HostSessionNodeRecord): HostSessionNodeRecord => ({...node})

const cloneRecord = (record: HostSessionRecord): HostSessionRecord => {
    return {
        ...record,
        ticket: {...record.ticket},
        compatibility: {
            ...record.compatibility,
            reasons: [...record.compatibility.reasons],
            enabledCapabilities: [...record.compatibility.enabledCapabilities],
            disabledCapabilities: [...record.compatibility.disabledCapabilities],
        },
        nodes: Object.fromEntries(
            Object.entries(record.nodes).map(([nodeId, node]) => [nodeId, cloneNode(node)]),
        ),
        resume: {
            ...record.resume,
            pendingNodeIds: [...record.resume.pendingNodeIds],
        },
    }
}

export const createSessionRegistry = (): SessionRegistry => {
    const sessions = new Map<SessionId, HostSessionRecord>()
    const tokenToSessionId = new Map<string, SessionId>()
    const connections = new Map<ConnectionId, HostConnectionRecord>()

    const resolveStatus = (record: HostSessionRecord): HostSessionRecord['status'] => {
        const nodes = Object.values(record.nodes)
        if (nodes.every(node => node.connected === false && node.disconnectedAt != null)) {
            return 'closed'
        }
        if (nodes.length < 2) {
            return 'awaiting-peer'
        }
        if (record.resume.phase === 'required') {
            return 'resume-required'
        }
        if (record.resume.phase === 'resyncing') {
            return 'resyncing'
        }
        if (record.compatibility.level === 'degraded') {
            return 'degraded'
        }
        return 'active'
    }

    return {
        create(input) {
            const session: HostSessionRecord = {
                sessionId: input.sessionId,
                token: input.ticket.token,
                ticket: {...input.ticket},
                status: 'awaiting-peer',
                compatibility: input.compatibility,
                createdAt: input.createdAt,
                updatedAt: input.createdAt,
                nodes: {
                    [input.nodeRuntime.nodeId]: {
                        nodeId: input.nodeRuntime.nodeId,
                        role: input.nodeRuntime.role,
                        runtime: {...input.nodeRuntime},
                        lastHelloAt: input.createdAt,
                        connected: false,
                    },
                },
                relayPendingCount: 0,
                resume: {
                    phase: 'idle',
                    pendingNodeIds: [],
                },
            }

            sessions.set(input.sessionId, session)
            tokenToSessionId.set(input.ticket.token, input.sessionId)
            return cloneRecord(session)
        },
        get(sessionId) {
            const session = sessions.get(sessionId)
            return session ? cloneRecord(session) : undefined
        },
        getByToken(token) {
            const sessionId = tokenToSessionId.get(token)
            return sessionId ? this.get(sessionId) : undefined
        },
        attachConnection(input) {
            const session = sessions.get(input.sessionId)
            if (!session) {
                throw new Error(`session not found: ${input.sessionId}`)
            }
            const node = session.nodes[input.nodeId]
            if (!node) {
                throw new Error(`node not found: ${input.nodeId}`)
            }

            const replacedConnectionId = node.connectionId
            if (replacedConnectionId) {
                connections.delete(replacedConnectionId)
            }

            node.connectionId = input.connectionId
            node.connected = true
            node.connectedAt = input.connectedAt
            node.disconnectedAt = undefined
            node.lastHeartbeatAt = input.connectedAt
            session.updatedAt = input.connectedAt
            session.status = resolveStatus(session)

            connections.set(input.connectionId, {
                sessionId: input.sessionId,
                nodeId: input.nodeId as any,
                connectionId: input.connectionId,
                connectedAt: input.connectedAt,
                lastHeartbeatAt: input.connectedAt,
            })

            return {
                sessionId: input.sessionId,
                nodeId: input.nodeId as any,
                connectionId: input.connectionId,
                replacedConnectionId,
            }
        },
        detachConnection(input) {
            const target = input.connectionId
                ? connections.get(input.connectionId)
                : [...connections.values()].find(connection => {
                    return connection.sessionId === input.sessionId && connection.nodeId === input.nodeId
                })

            if (!target) {
                return undefined
            }

            const session = sessions.get(target.sessionId)
            if (!session) {
                connections.delete(target.connectionId)
                return undefined
            }

            const node = session.nodes[target.nodeId]
            if (!node) {
                connections.delete(target.connectionId)
                return undefined
            }

            node.connected = false
            node.connectionId = undefined
            node.disconnectedAt = input.disconnectedAt
            session.resume = {
                phase: 'required',
                pendingNodeIds: [target.nodeId],
                requiredAt: input.disconnectedAt,
                reason: input.reason,
            }
            session.updatedAt = input.disconnectedAt
            session.status = resolveStatus(session)
            connections.delete(target.connectionId)

            return {
                sessionId: target.sessionId,
                nodeId: target.nodeId,
                connectionId: target.connectionId,
                reason: input.reason,
                disconnectedAt: input.disconnectedAt,
            }
        },
        beginResume(input) {
            const session = sessions.get(input.sessionId)
            if (!session) {
                throw new Error(`session not found: ${input.sessionId}`)
            }
            if (!session.nodes[input.nodeId]) {
                throw new Error(`node not found: ${input.nodeId}`)
            }

            session.resume = {
                ...session.resume,
                phase: 'resyncing',
                pendingNodeIds: Array.from(new Set([
                    ...session.resume.pendingNodeIds,
                    input.nodeId as any,
                ])),
                startedAt: input.startedAt,
            }
            session.updatedAt = input.startedAt
            session.status = resolveStatus(session)
            return cloneRecord(session)
        },
        completeResume(input) {
            const session = sessions.get(input.sessionId)
            if (!session) {
                throw new Error(`session not found: ${input.sessionId}`)
            }
            session.resume = {
                ...session.resume,
                pendingNodeIds: session.resume.pendingNodeIds.filter(nodeId => nodeId !== input.nodeId),
                completedAt: input.completedAt,
            }
            session.resume.phase = session.resume.pendingNodeIds.length === 0 ? 'idle' : 'resyncing'
            session.updatedAt = input.completedAt
            session.status = resolveStatus(session)
            return cloneRecord(session)
        },
        markHeartbeat(input) {
            const connection = connections.get(input.connectionId)
            if (!connection) {
                return undefined
            }

            const session = sessions.get(connection.sessionId)
            if (!session) {
                connections.delete(input.connectionId)
                return undefined
            }

            const node = session.nodes[connection.nodeId]
            if (!node) {
                connections.delete(input.connectionId)
                return undefined
            }

            connection.lastHeartbeatAt = input.occurredAt
            node.lastHeartbeatAt = input.occurredAt
            session.updatedAt = input.occurredAt

            return {...connection}
        },
        updateHello(input) {
            const session = sessions.get(input.sessionId)
            if (!session) {
                throw new Error(`session not found: ${input.sessionId}`)
            }

            const currentNode = session.nodes[input.runtime.nodeId]
            if (currentNode) {
                currentNode.runtime = {...input.runtime}
                currentNode.lastHelloAt = input.occurredAt
            } else {
                session.nodes[input.runtime.nodeId] = {
                    nodeId: input.runtime.nodeId,
                    role: input.runtime.role,
                    runtime: {...input.runtime},
                    lastHelloAt: input.occurredAt,
                    connected: false,
                }
            }

            session.compatibility = input.compatibility
            session.updatedAt = input.occurredAt
            session.status = resolveStatus(session)
            return cloneRecord(session)
        },
        updateRelayPending(sessionId, pendingCount, updatedAt) {
            const session = sessions.get(sessionId)
            if (!session) {
                return
            }
            session.relayPendingCount = pendingCount
            session.updatedAt = updatedAt
        },
        list() {
            return [...sessions.values()].map(cloneRecord)
        },
        findConnection(connectionId) {
            const record = connections.get(connectionId)
            return record ? {...record} : undefined
        },
        listConnections() {
            return [...connections.values()].map(connection => ({...connection}))
        },
    }
}
