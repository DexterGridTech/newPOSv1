import type {ConnectionId, SessionId} from '@impos2/kernel-base-contracts'
import {createHostEnvelopeId} from './ids'
import type {
    HostRelayCounters,
    HostRelayDelivery,
    HostRelayEnvelope,
    HostRelayResult,
} from '../types/relay'

interface QueueEntry {
    delivery: HostRelayDelivery
}

export interface RelayRegistry {
    enqueue(input: {
        sessionId: SessionId
        channel: HostRelayResult['channel']
        sourceNodeId: string
        targetNodeId: string
        connectionId: ConnectionId
        envelope: HostRelayEnvelope
        availableAt: number
    }): HostRelayDelivery
    enqueueOffline(input: {
        sessionId: SessionId
        channel: HostRelayResult['channel']
        sourceNodeId: string
        targetNodeId: string
        envelope: HostRelayEnvelope
        availableAt: number
    }): HostRelayDelivery
    rebindConnection(input: {
        sessionId: SessionId
        targetNodeId: string
        connectionId: ConnectionId
    }): readonly HostRelayDelivery[]
    drain(connectionId: ConnectionId, now: number, channels?: readonly HostRelayResult['channel'][]): readonly HostRelayDelivery[]
    pendingCount(sessionId: SessionId): number
    markDropped(): void
    markDisconnected(): void
    snapshotCounters(): HostRelayCounters
}

export const createRelayRegistry = (): RelayRegistry => {
    const queueByConnection = new Map<ConnectionId, QueueEntry[]>()
    const queueBySession = new Map<SessionId, number>()
    const offlineQueueByTarget = new Map<string, QueueEntry[]>()
    const sequenceBySessionChannel = new Map<string, number>()
    const counters: HostRelayCounters = {
        enqueued: 0,
        delivered: 0,
        dropped: 0,
        flushed: 0,
        disconnected: 0,
    }

    const getSequenceKey = (sessionId: SessionId, channel: HostRelayResult['channel']) => {
        return `${sessionId}:${channel}`
    }

    const getOfflineTargetKey = (sessionId: SessionId, targetNodeId: string) => {
        return `${sessionId}:${targetNodeId}`
    }

    const recomputeSessionPendingCount = (sessionId: SessionId) => {
        const connectionCount = [...queueByConnection.values()]
            .flat()
            .filter(entry => entry.delivery.sessionId === sessionId)
            .length
        const offlineCount = [...offlineQueueByTarget.entries()]
            .filter(([key]) => key.startsWith(`${sessionId}:`))
            .flatMap(([, entries]) => entries)
            .length
        queueBySession.set(sessionId, connectionCount + offlineCount)
    }

    return {
        enqueue(input) {
            const sequenceKey = getSequenceKey(input.sessionId, input.channel)
            const nextSequence = (sequenceBySessionChannel.get(sequenceKey) ?? 0) + 1
            sequenceBySessionChannel.set(sequenceKey, nextSequence)

            const delivery: HostRelayDelivery = {
                relayId: createHostEnvelopeId(),
                sessionId: input.sessionId,
                channel: input.channel,
                sourceNodeId: input.sourceNodeId as any,
                targetNodeId: input.targetNodeId as any,
                connectionId: input.connectionId,
                sequence: nextSequence,
                availableAt: input.availableAt,
                envelope: input.envelope,
            }

            const entries = queueByConnection.get(input.connectionId) ?? []
            entries.push({delivery})
            queueByConnection.set(input.connectionId, entries)
            queueBySession.set(input.sessionId, (queueBySession.get(input.sessionId) ?? 0) + 1)
            counters.enqueued += 1
            return delivery
        },
        enqueueOffline(input) {
            const sequenceKey = getSequenceKey(input.sessionId, input.channel)
            const nextSequence = (sequenceBySessionChannel.get(sequenceKey) ?? 0) + 1
            sequenceBySessionChannel.set(sequenceKey, nextSequence)

            const delivery: HostRelayDelivery = {
                relayId: createHostEnvelopeId(),
                sessionId: input.sessionId,
                channel: input.channel,
                sourceNodeId: input.sourceNodeId as any,
                targetNodeId: input.targetNodeId as any,
                connectionId: '__offline__' as ConnectionId,
                sequence: nextSequence,
                availableAt: input.availableAt,
                envelope: input.envelope,
            }

            const key = getOfflineTargetKey(input.sessionId, input.targetNodeId)
            const queued = offlineQueueByTarget.get(key) ?? []
            queued.push({delivery})
            offlineQueueByTarget.set(key, queued)
            queueBySession.set(input.sessionId, (queueBySession.get(input.sessionId) ?? 0) + 1)
            counters.enqueued += 1
            return delivery
        },
        rebindConnection(input) {
            const key = getOfflineTargetKey(input.sessionId, input.targetNodeId)
            const queued = offlineQueueByTarget.get(key) ?? []
            if (queued.length === 0) {
                return []
            }

            const reboundDeliveries = queued.map(entry => {
                const rebound: HostRelayDelivery = {
                    ...entry.delivery,
                    connectionId: input.connectionId,
                }
                const entries = queueByConnection.get(input.connectionId) ?? []
                entries.push({delivery: rebound})
                queueByConnection.set(input.connectionId, entries)
                return rebound
            })

            offlineQueueByTarget.delete(key)
            return reboundDeliveries
        },
        drain(connectionId, now, channels) {
            const entries = queueByConnection.get(connectionId) ?? []
            const ready = entries.filter(entry => {
                return entry.delivery.availableAt <= now
                    && (!channels || channels.includes(entry.delivery.channel))
            })
            const remaining = entries.filter(entry => {
                return entry.delivery.availableAt > now
                    || (channels ? !channels.includes(entry.delivery.channel) : false)
            })

            if (remaining.length > 0) {
                queueByConnection.set(connectionId, remaining)
            } else {
                queueByConnection.delete(connectionId)
            }

            ready.forEach(entry => {
                recomputeSessionPendingCount(entry.delivery.sessionId)
            })

            counters.delivered += ready.length
            counters.flushed += ready.length
            return ready.map(entry => entry.delivery)
        },
        pendingCount(sessionId) {
            return queueBySession.get(sessionId) ?? 0
        },
        markDropped() {
            counters.dropped += 1
        },
        markDisconnected() {
            counters.disconnected += 1
        },
        snapshotCounters() {
            return {...counters}
        },
    }
}
