import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {PairingTicket, SessionId} from '@impos2/kernel-base-contracts'
import type {
    HostTicketOccupancy,
    HostTicketRecord,
} from '../types/session'

export interface TicketRegistry {
    issue(ticket: PairingTicket): HostTicketRecord
    get(token: string): HostTicketRecord | undefined
    bindSession(token: string, sessionId: SessionId, updatedAt: number): HostTicketRecord
    occupy(
        token: string,
        occupancy: HostTicketOccupancy,
        updatedAt: number,
    ): HostTicketRecord
    list(): readonly HostTicketRecord[]
}

const cloneRecord = (record: HostTicketRecord): HostTicketRecord => {
    return {
        ...record,
        ticket: {...record.ticket},
        occupiedRoles: {
            master: record.occupiedRoles.master ? {...record.occupiedRoles.master} : undefined,
            slave: record.occupiedRoles.slave ? {...record.occupiedRoles.slave} : undefined,
        },
    }
}

export const createTicketRegistry = (): TicketRegistry => {
    const records = new Map<string, HostTicketRecord>()

    return {
        issue(ticket) {
            const record: HostTicketRecord = {
                ticket: {...ticket},
                occupiedRoles: {},
                updatedAt: ticket.issuedAt ?? nowTimestampMs(),
            }
            records.set(ticket.token, record)
            return cloneRecord(record)
        },
        get(token) {
            const record = records.get(token)
            return record ? cloneRecord(record) : undefined
        },
        bindSession(token, sessionId, updatedAt) {
            const record = records.get(token)
            if (!record) {
                throw new Error(`ticket not found: ${token}`)
            }
            record.sessionId = sessionId
            record.updatedAt = updatedAt
            return cloneRecord(record)
        },
        occupy(token, occupancy, updatedAt) {
            const record = records.get(token)
            if (!record) {
                throw new Error(`ticket not found: ${token}`)
            }
            record.occupiedRoles[occupancy.role] = {...occupancy}
            record.updatedAt = updatedAt
            return cloneRecord(record)
        },
        list() {
            return [...records.values()].map(cloneRecord)
        },
    }
}
