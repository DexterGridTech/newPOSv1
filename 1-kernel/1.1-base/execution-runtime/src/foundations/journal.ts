import type {
    ExecutionJournal,
    ExecutionJournalRecord,
} from '../types/journal'

const DEFAULT_MAX_RECORDS = 1_000

const resolveMaxRecords = (maxRecords?: number): number => {
    if (maxRecords == null) {
        return DEFAULT_MAX_RECORDS
    }
    if (!Number.isFinite(maxRecords) || maxRecords < 1) {
        return DEFAULT_MAX_RECORDS
    }
    return Math.floor(maxRecords)
}

export const createExecutionJournal = (maxRecords?: number): ExecutionJournal => {
    const records: ExecutionJournalRecord[] = []
    const limit = resolveMaxRecords(maxRecords)

    return {
        append(record) {
            records.push(record)
            if (records.length > limit) {
                records.splice(0, records.length - limit)
            }
        },
        list() {
            return [...records]
        },
    }
}
