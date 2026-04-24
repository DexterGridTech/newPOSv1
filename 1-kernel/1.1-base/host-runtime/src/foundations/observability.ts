import {nowTimestampMs} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import {createHostObservationId} from './ids'
import type {HostObservationEvent} from '../types/host'

export interface CreateHostObservabilityInput {
    logger: LoggerPort
    maxEvents: number
}

export interface HostObservability {
    record(
        input: Omit<HostObservationEvent, 'observationId' | 'timestamp'> & {
            timestamp?: number
        },
    ): HostObservationEvent
    list(): readonly HostObservationEvent[]
}

export const createHostObservability = (
    input: CreateHostObservabilityInput,
): HostObservability => {
    const events: HostObservationEvent[] = []

    return {
        record(eventInput) {
            const event: HostObservationEvent = {
                observationId: createHostObservationId(),
                timestamp: eventInput.timestamp ?? nowTimestampMs(),
                level: eventInput.level,
                category: eventInput.category,
                event: eventInput.event,
                message: eventInput.message,
                sessionId: eventInput.sessionId,
                nodeId: eventInput.nodeId,
                connectionId: eventInput.connectionId,
                data: eventInput.data,
            }

            events.push(event)
            if (events.length > input.maxEvents) {
                events.shift()
            }

            input.logger[event.level]({
                category: event.category,
                event: event.event,
                message: event.message,
                context: {
                    sessionId: event.sessionId,
                    nodeId: event.nodeId,
                    connectionId: event.connectionId,
                },
                data: event.data,
            })

            return event
        },
        list() {
            return [...events]
        },
    }
}
