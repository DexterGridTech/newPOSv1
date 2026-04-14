import type {
    HttpEndpointDefinition,
    TypeDescriptor,
} from '../types/http'
import {appendQueryToUrl, compilePath} from './shared'

interface DefineHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError = unknown> {
    readonly name: string
    readonly serverName: string
    readonly method: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>['method']
    readonly pathTemplate: string
    readonly timeoutMs?: number
    readonly request?: {
        readonly path?: TypeDescriptor<TPath>
        readonly query?: TypeDescriptor<TQuery>
        readonly body?: TypeDescriptor<TBody>
        readonly headers?: TypeDescriptor<Record<string, string>>
    }
    readonly response?: TypeDescriptor<TResponse>
    readonly error?: TypeDescriptor<TError>
    readonly meta?: Record<string, unknown>
}

const trimTrailingSlash = (value: string): string => {
    return value.endsWith('/') ? value.slice(0, -1) : value
}

const trimLeadingSlash = (value: string): string => {
    return value.startsWith('/') ? value.slice(1) : value
}

export const defineHttpEndpoint = <TPath, TQuery, TBody, TResponse, TError = unknown>(
    input: DefineHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError>,
): HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError> => {
    return {
        protocol: 'http',
        name: input.name,
        serverName: input.serverName,
        method: input.method,
        pathTemplate: input.pathTemplate,
        timeoutMs: input.timeoutMs,
        request: input.request ?? {},
        response: input.response ?? {kind: 'type-descriptor', name: `${input.name}.response`},
        error: input.error,
        meta: input.meta,
    }
}

export const buildHttpUrl = (
    baseUrl: string,
    pathTemplate: string,
    path?: Record<string, unknown>,
    query?: Record<string, unknown>,
): string => {
    const compiledPath = compilePath(pathTemplate, path)
    const joinedUrl = `${trimTrailingSlash(baseUrl)}/${trimLeadingSlash(compiledPath)}`
    const url = new URL(joinedUrl)
    return appendQueryToUrl(url, query).toString()
}
