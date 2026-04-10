import type {
    ExecutionJournal,
    ExecutionJournalRecord,
} from '../types/journal'

export const createExecutionJournal = (): ExecutionJournal => {
    const records: ExecutionJournalRecord[] = []

    return {
        append(record) {
            records.push(record)
        },
        list() {
            return [...records]
        },
    }
}
