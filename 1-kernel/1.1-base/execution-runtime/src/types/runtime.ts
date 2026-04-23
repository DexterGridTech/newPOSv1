import type {AppError} from '@impos2/kernel-base-contracts'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
import type {
    ExecutionCommand,
    ExecutionHandler,
    ExecutionLifecycleEvent,
    ExecutionMiddleware,
    ExecutionResult,
} from './execution'
import type {ExecutionJournal} from './journal'

export interface CreateExecutionRuntimeInput {
    logger: LoggerPort
    middlewares?: readonly ExecutionMiddleware[]
    onLifecycleEvent?: (event: ExecutionLifecycleEvent) => void
    maxJournalRecords?: number
}

export interface ExecuteCommandOptions {
    onLifecycleEvent?: (event: ExecutionLifecycleEvent) => void
}

export interface ExecutionRuntime {
    registerHandler(commandName: string, handler: ExecutionHandler): void
    execute(command: ExecutionCommand, options?: ExecuteCommandOptions): Promise<ExecutionResult>
    normalizeError(error: unknown, command: ExecutionCommand): AppError
    getJournal(): ExecutionJournal
}
