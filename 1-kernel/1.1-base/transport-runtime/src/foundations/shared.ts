import {createTransportConfigurationError} from '../supports'

export {
    createTransportConfigurationError,
    createTransportNetworkError,
    createTransportParseError,
} from '../supports'

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
