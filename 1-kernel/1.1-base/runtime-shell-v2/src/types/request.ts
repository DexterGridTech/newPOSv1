import type {
    CommandId,
    RequestId,
    TimestampMs,
} from '@next/kernel-base-contracts'
import type {CommandQueryResult} from './command'

export type RequestQueryStatus = 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED' | 'TIMEOUT'

export interface RequestQueryResult {
    requestId: RequestId
    rootCommandId: CommandId
    status: RequestQueryStatus
    startedAt: TimestampMs
    updatedAt: TimestampMs
    commands: readonly CommandQueryResult[]
}

export type RequestListener = (request: RequestQueryResult) => void
