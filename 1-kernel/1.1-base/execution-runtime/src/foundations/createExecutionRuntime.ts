import {createAppError, isAppError, nowTimestampMs} from '@next/kernel-base-contracts'
import type {AppError, CreateAppErrorInput} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import {createExecutionJournal} from './journal'
import type {
    ExecutionCommand,
    ExecutionContext,
    ExecutionHandler,
    ExecutionLifecycleEvent,
    ExecutionMiddleware,
    ExecutionResult,
} from '../types/execution'
import type {
    CreateExecutionRuntimeInput,
    ExecuteCommandOptions,
    ExecutionRuntime,
} from '../types/runtime'
import {executionRuntimeErrorDefinitions} from '../supports'

const createLifecycleEvent = (
    eventType: ExecutionLifecycleEvent['eventType'],
    command: ExecutionCommand,
): ExecutionLifecycleEvent => {
    return {
        eventType,
        commandId: command.commandId,
        requestId: command.requestId,
        commandName: command.commandName,
        internal: command.internal === true,
        occurredAt: nowTimestampMs(),
    }
}

const createCommandScopeLogger = (logger: LoggerPort, command: ExecutionCommand): LoggerPort => {
    return logger.withContext({
        requestId: command.requestId,
        commandId: command.commandId,
        commandName: command.commandName,
        sessionId: command.sessionId,
    })
}

const createNormalizeError = (logger: LoggerPort) => {
    return (error: unknown, command: ExecutionCommand): AppError => {
        if (isAppError(error)) {
            return error
        }

        const input: CreateAppErrorInput = {
            args: {commandName: command.commandName},
            context: {
                commandName: command.commandName,
                commandId: command.commandId,
                requestId: command.requestId,
                sessionId: command.sessionId,
            },
            cause: error,
            details: {
                error:
                    error instanceof Error
                        ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack,
                        }
                        : error,
            },
        }

        const appError = createAppError(executionRuntimeErrorDefinitions.commandExecutionFailed, input)

        logger.error({
            category: 'command.lifecycle',
            event: 'normalize-error',
            message: appError.message,
            context: {
                requestId: command.requestId,
                commandId: command.commandId,
                commandName: command.commandName,
                sessionId: command.sessionId,
            },
            error: {
                name: error instanceof Error ? error.name : undefined,
                code: appError.code,
                message: error instanceof Error ? error.message : appError.message,
                stack: error instanceof Error ? error.stack : undefined,
            },
        })

        return appError
    }
}

const runWithMiddlewares = async (
    middlewares: readonly ExecutionMiddleware[],
    context: ExecutionContext,
    handler: () => Promise<ExecutionResult>,
): Promise<ExecutionResult> => {
    let index = -1

    const dispatch = async (cursor: number): Promise<ExecutionResult> => {
        if (cursor <= index) {
            throw new Error('Execution middleware chain re-entry is not allowed')
        }
        index = cursor

        const middleware = middlewares[cursor]
        if (!middleware) {
            return handler()
        }

        return middleware.handle(context, () => dispatch(cursor + 1))
    }

    return dispatch(0)
}

export const createExecutionRuntime = (
    input: CreateExecutionRuntimeInput,
): ExecutionRuntime => {
    const handlers = new Map<string, ExecutionHandler>()
    const journal = createExecutionJournal(input.maxJournalRecords)
    const middlewares = [...(input.middlewares ?? [])]
    const normalizeError = createNormalizeError(input.logger)

    const emitLifecycle = (event: ExecutionLifecycleEvent) => {
        journal.append(event)
        input.onLifecycleEvent?.(event)
    }

    const createFailedResult = (
        error: unknown,
        command: ExecutionCommand,
        emitObservedLifecycle: (event: ExecutionLifecycleEvent) => void,
        commandLogger: LoggerPort,
    ): ExecutionResult => {
        const appError = normalizeError(error, command)
        const failedEvent = createLifecycleEvent('failed', command)
        emitObservedLifecycle(failedEvent)

        commandLogger.error({
            category: 'command.lifecycle',
            event: 'failed',
            message: appError.message,
            error: {
                name: appError.name,
                code: appError.code,
                message: appError.message,
                stack: appError.stack,
            },
        })

        return {
            status: 'failed',
            error: appError,
        }
    }

    const execute = async (
        command: ExecutionCommand,
        options?: ExecuteCommandOptions,
    ): Promise<ExecutionResult> => {
        const commandLogger = createCommandScopeLogger(input.logger, command)
        const handler = handlers.get(command.commandName)

        if (!handler) {
            throw createAppError(executionRuntimeErrorDefinitions.commandNotFound, {
                args: {commandName: command.commandName},
                context: {
                    commandName: command.commandName,
                    commandId: command.commandId,
                    requestId: command.requestId,
                    sessionId: command.sessionId,
                },
            })
        }

        const emitObservedLifecycle = (event: ExecutionLifecycleEvent) => {
            emitLifecycle(event)
            options?.onLifecycleEvent?.(event)
        }

        const startedEvent = createLifecycleEvent('started', command)
        emitObservedLifecycle(startedEvent)

        commandLogger.info({
            category: 'command.lifecycle',
            event: 'started',
            message: `execute ${command.commandName}`,
        })

        const context: ExecutionContext = {
            command,
            dispatchChild: child => execute(child),
        }

        const runHandler = async (): Promise<ExecutionResult> => {
            try {
                const result = await handler(context)
                const completedEvent = createLifecycleEvent('completed', command)
                emitObservedLifecycle(completedEvent)

                commandLogger.info({
                    category: 'command.lifecycle',
                    event: 'completed',
                    message: `completed ${command.commandName}`,
                    data: result ? {result} : undefined,
                })

                return {
                    status: 'completed',
                    result: result ?? undefined,
                }
            } catch (error) {
                return createFailedResult(error, command, emitObservedLifecycle, commandLogger)
            }
        }

        try {
            return await runWithMiddlewares(middlewares, context, runHandler)
        } catch (error) {
            return createFailedResult(error, command, emitObservedLifecycle, commandLogger)
        }
    }

    return {
        registerHandler(commandName, handler) {
            if (handlers.has(commandName)) {
                throw new Error(`Duplicated handler: ${commandName}`)
            }
            handlers.set(commandName, handler)
        },
        execute,
        normalizeError,
        getJournal() {
            return journal
        },
    }
}
