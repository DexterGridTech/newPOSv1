import type {CommandId, RequestId, TimestampMs} from '@next/kernel-base-contracts'

export interface ExecutionJournalRecord {
    eventType: 'started' | 'completed' | 'failed'
    commandId: CommandId
    requestId: RequestId
    commandName: string
    internal: boolean
    occurredAt: TimestampMs
}

export interface ExecutionJournal {
    append(record: ExecutionJournalRecord): void
    list(): readonly ExecutionJournalRecord[]
}
