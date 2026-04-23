import type {AppError, CreateAppErrorInput, ErrorDefinition} from '../types/error'
import {nowTimestampMs} from './time'

export const renderErrorTemplate = (
    template: string,
    args?: Record<string, unknown>,
): string => {
    return template.replace(/\$\{([\s\S]+?)\}/g, (_match, key) => {
        const value = args?.[String(key).trim()]
        return value == null ? '' : String(value)
    })
}

export const createAppError = (
    definition: ErrorDefinition,
    input: CreateAppErrorInput = {},
): AppError => {
    return {
        name: definition.name,
        key: definition.key,
        code: definition.code ?? definition.key,
        message: renderErrorTemplate(definition.defaultTemplate, input.args),
        category: definition.category,
        severity: definition.severity,
        createdAt: nowTimestampMs(),
        commandName: input.context?.commandName,
        commandId: input.context?.commandId,
        requestId: input.context?.requestId,
        sessionId: input.context?.sessionId,
        nodeId: input.context?.nodeId,
        args: input.args,
        details: input.details,
        cause: input.cause,
    }
}

export const isAppError = (value: unknown): value is AppError => {
    if (typeof value !== 'object' || value == null) {
        return false
    }
    const candidate = value as Partial<AppError>
    return typeof candidate.key === 'string'
        && typeof candidate.message === 'string'
        && typeof candidate.code === 'string'
        && typeof candidate.category === 'string'
        && typeof candidate.severity === 'string'
        && typeof candidate.createdAt === 'number'
}
