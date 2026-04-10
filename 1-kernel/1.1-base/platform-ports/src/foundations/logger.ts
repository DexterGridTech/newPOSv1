import {nowTimestampMs} from '@impos2/kernel-base-contracts'
import type {
    CreateLoggerPortInput,
    LogContext,
    LogEnvironmentMode,
    LogEvent,
    LoggerPort,
    LogScope,
    LogWriteInput,
} from '../types/logging'

const SENSITIVE_FIELD_PATTERN = /(token|password|credential|secret|phone|mobile|idNumber|identity|payment)/i

const containsSensitiveRaw = (value: unknown): boolean => {
    if (value == null) {
        return false
    }
    if (typeof value === 'string') {
        return false
    }
    if (Array.isArray(value)) {
        return value.some(containsSensitiveRaw)
    }
    if (typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).some(([key, nestedValue]) => {
            return SENSITIVE_FIELD_PATTERN.test(key) || containsSensitiveRaw(nestedValue)
        })
    }
    return false
}

const maskValue = (value: unknown): unknown => {
    if (value == null) {
        return value
    }
    if (Array.isArray(value)) {
        return value.map(maskValue)
    }
    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
                if (SENSITIVE_FIELD_PATTERN.test(key)) {
                    return [key, '[MASKED]']
                }
                return [key, maskValue(nestedValue)]
            }),
        )
    }
    return value
}

const resolveMaskingMode = (environmentMode: LogEnvironmentMode): 'raw' | 'masked' => {
    return environmentMode === 'PROD' ? 'masked' : 'raw'
}

const createLogEvent = (
    level: LogEvent['level'],
    input: LogWriteInput,
    scope: LogScope,
    context: LogContext | undefined,
    environmentMode: LogEnvironmentMode,
): LogEvent => {
    const maskingMode = resolveMaskingMode(environmentMode)
    const mergedContext = {
        ...context,
        ...input.context,
    }
    const maskedData = maskingMode === 'masked' ? maskValue(input.data) : input.data

    return {
        timestamp: nowTimestampMs(),
        level,
        category: input.category,
        event: input.event,
        message: input.message,
        scope,
        context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
        data: maskedData as Record<string, unknown> | undefined,
        error: input.error,
        security: {
            containsSensitiveRaw: containsSensitiveRaw(input.data),
            maskingMode,
        },
    }
}

export const createLoggerPort = (input: CreateLoggerPortInput): LoggerPort => {
    const createScopedLogger = (
        scope: LogScope,
        context: LogContext | undefined,
    ): LoggerPort => {
        const emitLevel = (level: LogEvent['level'], eventInput: LogWriteInput) => {
            input.write(createLogEvent(level, eventInput, scope, context, input.environmentMode))
        }

        return {
            emit(event) {
                input.write(event)
            },
            debug(eventInput) {
                emitLevel('debug', eventInput)
            },
            info(eventInput) {
                emitLevel('info', eventInput)
            },
            warn(eventInput) {
                emitLevel('warn', eventInput)
            },
            error(eventInput) {
                emitLevel('error', eventInput)
            },
            scope(binding) {
                return createScopedLogger({...scope, ...binding}, context)
            },
            withContext(nextContext) {
                return createScopedLogger(scope, {...context, ...nextContext})
            },
        }
    }

    return createScopedLogger(input.scope, input.context)
}
