import {createAppError, nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {
    AppError,
    CreateAppErrorInput,
    ErrorDefinition,
} from '@impos2/kernel-base-contracts'
import type {LoggerPort} from '@impos2/kernel-base-platform-ports'
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

const COMMAND_NOT_FOUND_ERROR: ErrorDefinition = {
    key: 'kernel.base.execution-runtime.command_not_found',
    name: 'Execution Command Not Found',
    defaultTemplate: 'Execution handler not found for ${commandName}',
    category: 'SYSTEM',
    severity: 'HIGH',
    moduleName: 'kernel.base.execution-runtime',
}

const COMMAND_EXECUTION_FAILED_ERROR: ErrorDefinition = {
    key: 'kernel.base.execution-runtime.command_execution_failed',
    name: 'Execution Command Failed',
    defaultTemplate: 'Execution failed for ${commandName}',
    category: 'SYSTEM',
    severity: 'MEDIUM',
    moduleName: 'kernel.base.execution-runtime',
}

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
        if (typeof error === 'object' && error !== null && 'key' in error && 'message' in error) {
            return error as AppError
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

        const appError = createAppError(COMMAND_EXECUTION_FAILED_ERROR, input)

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
    const journal = createExecutionJournal()
    const middlewares = [...(input.middlewares ?? [])]
    const normalizeError = createNormalizeError(input.logger)

    const emitLifecycle = (event: ExecutionLifecycleEvent) => {
        journal.append(event)
        input.onLifecycleEvent?.(event)
    }

    const execute = async (
        command: ExecutionCommand,
        options?: ExecuteCommandOptions,
    ): Promise<ExecutionResult> => {
        const commandLogger = createCommandScopeLogger(input.logger, command)
        const handler = handlers.get(command.commandName)

        if (!handler) {
            throw createAppError(COMMAND_NOT_FOUND_ERROR, {
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
        }

        return runWithMiddlewares(middlewares, context, runHandler)
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
