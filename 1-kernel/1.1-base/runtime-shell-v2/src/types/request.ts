import type {
    CommandId,
    RequestId,
    TimestampMs,
} from '@impos2/kernel-base-contracts'
import type {CommandAggregateResult} from './command'

export type RequestQueryStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED' | 'TIMEOUT'

export interface RequestQueryResult {
    requestId: RequestId
    rootCommandId: CommandId
    status: RequestQueryStatus
    startedAt: TimestampMs
    updatedAt: TimestampMs
    commands: readonly CommandAggregateResult[]
}

export type RequestListener = (request: RequestQueryResult) => void
