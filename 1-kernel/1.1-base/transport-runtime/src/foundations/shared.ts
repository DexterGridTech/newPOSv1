import {createAppError} from '@impos2/kernel-base-contracts'
import type {ErrorDefinition} from '@impos2/kernel-base-contracts'

const TRANSPORT_CONFIGURATION_ERROR: ErrorDefinition = {
    key: 'kernel.base.transport-runtime.configuration_error',
    name: 'Transport Configuration Error',
    defaultTemplate: '${message}',
    category: 'SYSTEM',
    severity: 'HIGH',
    moduleName: 'kernel.base.transport-runtime',
}

const TRANSPORT_NETWORK_ERROR: ErrorDefinition = {
    key: 'kernel.base.transport-runtime.network_error',
    name: 'Transport Network Error',
    defaultTemplate: '${message}',
    category: 'NETWORK',
    severity: 'MEDIUM',
    moduleName: 'kernel.base.transport-runtime',
}

const TRANSPORT_PARSE_ERROR: ErrorDefinition = {
    key: 'kernel.base.transport-runtime.parse_error',
    name: 'Transport Parse Error',
    defaultTemplate: '${message}',
    category: 'VALIDATION',
    severity: 'MEDIUM',
    moduleName: 'kernel.base.transport-runtime',
}

export const createTransportConfigurationError = (message: string, details?: unknown) => {
    return createAppError(TRANSPORT_CONFIGURATION_ERROR, {
        args: {message},
        details,
    })
}

export const createTransportNetworkError = (message: string, details?: unknown) => {
    return createAppError(TRANSPORT_NETWORK_ERROR, {
        args: {message},
        details,
    })
}

export const createTransportParseError = (message: string, details?: unknown) => {
    return createAppError(TRANSPORT_PARSE_ERROR, {
        args: {message},
        details,
    })
}

const PATH_PARAM_PATTERN = /\{([a-zA-Z0-9_]+)\}/g

const normalizePath = (path: string): string => {
    return path.startsWith('/') ? path : `/${path}`
}

export const typed = <T>(name?: string) => {
    return {
        kind: 'type-descriptor' as const,
        name,
    }
}

export const extractPathParamNames = (pathTemplate: string): string[] => {
    return Array.from(pathTemplate.matchAll(PATH_PARAM_PATTERN), match => match[1])
}

export const compilePath = <TPath extends Record<string, unknown>>(
    pathTemplate: string,
    pathParams?: TPath,
): string => {
    const normalizedTemplate = normalizePath(pathTemplate)
    const names = extractPathParamNames(normalizedTemplate)

    if (!names.length) {
        return normalizedTemplate
    }

    return names.reduce((currentPath, name) => {
        const rawValue = pathParams?.[name]
        if (rawValue === undefined || rawValue === null || rawValue === '') {
            throw createTransportConfigurationError(`Missing path param: ${name}`, {
                pathTemplate: normalizedTemplate,
                pathParams,
            })
        }

        return currentPath.replace(`{${name}}`, encodeURIComponent(String(rawValue)))
    }, normalizedTemplate)
}

export const appendQueryToUrl = (url: URL, query?: Record<string, unknown>): URL => {
    if (!query) {
        return url
    }

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) {
            return
        }

        if (Array.isArray(value)) {
            value.forEach(item => url.searchParams.append(key, String(item)))
            return
        }

        url.searchParams.set(key, String(value))
    })

    return url
}

export const normalizeHeaders = (headers?: Record<string, unknown>): Record<string, string> => {
    if (!headers) {
        return {}
    }

    return Object.fromEntries(
        Object.entries(headers)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)]),
    )
}
