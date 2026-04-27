import {
    createLoggerPort,
    type CreateLoggerPortInput,
    type LogEvent,
    type LogScope,
    type LoggerPort,
} from '@next/kernel-base-platform-ports'

const formatScope = (scope: LogScope): string => [
    scope.layer,
    scope.moduleName,
    scope.subsystem,
    scope.component,
].filter(Boolean).join(':')

const formatMessage = (event: LogEvent): string => [
    `[${event.level.toUpperCase()}]`,
    formatScope(event.scope),
    event.event,
    event.message ?? '',
].filter(Boolean).join(' ')

const selectConsoleWriter = (level: LogEvent['level']) => {
    if (level === 'error') {
        return console.error.bind(console)
    }
    if (level === 'warn') {
        return console.warn.bind(console)
    }
    if (level === 'debug') {
        return console.debug.bind(console)
    }
    return console.info.bind(console)
}

export interface CreateBrowserConsoleLoggerInput {
    scope: LogScope
    environmentMode?: CreateLoggerPortInput['environmentMode']
    sink?: (event: LogEvent) => void
}

export const createBrowserConsoleLogger = (
    input: CreateBrowserConsoleLoggerInput,
): LoggerPort => createLoggerPort({
    environmentMode: input.environmentMode ?? 'DEV',
    scope: input.scope,
    write(event) {
        input.sink?.(event)
        selectConsoleWriter(event.level)(
            formatMessage(event),
            {
                category: event.category,
                context: event.context,
                data: event.data,
                error: event.error,
                security: event.security,
                timestamp: event.timestamp,
            },
        )
    },
})
