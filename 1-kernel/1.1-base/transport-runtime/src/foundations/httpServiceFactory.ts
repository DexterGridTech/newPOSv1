import {createAppError} from '@impos2/kernel-base-contracts'
import type {
    AppError,
    ErrorDefinition,
} from '@impos2/kernel-base-contracts'
import type {
    HttpCallInput,
    HttpEndpointDefinition,
    HttpMethod,
    HttpRuntime,
    TypeDescriptor,
} from '../types/http'
import {defineHttpEndpoint} from './httpEndpoint'
import {typed} from './shared'
import {normalizeTransportError} from '../supports'

export interface DefineModuleHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError = unknown> {
    readonly method: HttpMethod
    readonly pathTemplate: string
    readonly timeoutMs?: number
    readonly request?: {
        readonly path?: true | TypeDescriptor<TPath>
        readonly query?: true | TypeDescriptor<TQuery>
        readonly body?: true | TypeDescriptor<TBody>
        readonly headers?: true | TypeDescriptor<Record<string, string>>
    }
    readonly response?: TypeDescriptor<TResponse>
    readonly error?: TypeDescriptor<TError>
    readonly meta?: Record<string, unknown>
}

export interface HttpResultEnvelope<TData> {
    readonly success: boolean
    readonly data: TData
    readonly error?: {
        readonly message?: string
        readonly details?: unknown
    }
}

export interface HttpCallErrorInput {
    readonly errorDefinition: ErrorDefinition
    readonly fallbackMessage: string
}

const createDescriptor = <T>(
    name: string,
    value?: true | TypeDescriptor<T>,
): TypeDescriptor<T> | undefined => {
    if (!value) {
        return undefined
    }

    if (value === true) {
        return typed<T>(name)
    }

    return value
}

export const createModuleHttpEndpointFactory = (
    moduleName: string,
    serverName: string,
) => {
    return <TPath, TQuery, TBody, TResponse, TError = unknown>(
        localKey: string,
        input: DefineModuleHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError>,
    ): HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError> => {
        const endpointName = `${moduleName}.${localKey}`
        return defineHttpEndpoint<TPath, TQuery, TBody, TResponse, TError>({
            name: endpointName,
            serverName,
            method: input.method,
            pathTemplate: input.pathTemplate,
            timeoutMs: input.timeoutMs,
            request: {
                path: createDescriptor<TPath>(`${endpointName}.path`, input.request?.path),
                query: createDescriptor<TQuery>(`${endpointName}.query`, input.request?.query),
                body: createDescriptor<TBody>(`${endpointName}.body`, input.request?.body),
                headers: createDescriptor<Record<string, string>>(`${endpointName}.headers`, input.request?.headers),
            },
            response: input.response ?? typed<TResponse>(`${endpointName}.response`),
            error: input.error,
            meta: input.meta,
        })
    }
}

const createHttpCallError = (
    normalized: AppError,
    input: HttpCallErrorInput,
): AppError => createAppError(input.errorDefinition, {
    args: {error: normalized.message},
    details: normalized,
    cause: normalized,
})

const createEnvelopeError = (
    message: string,
    details: unknown,
    input: HttpCallErrorInput,
): AppError => createAppError(input.errorDefinition, {
    args: {error: message},
    details,
})

export const callHttpResult = async <TPath, TQuery, TBody, TResponse, TError = unknown>(
    runtime: HttpRuntime,
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    requestInput: HttpCallInput<TPath, TQuery, TBody> | undefined,
    errorInput: HttpCallErrorInput,
): Promise<TResponse> => {
    try {
        const response = await runtime.call(endpoint, requestInput)
        return response.data
    } catch (error) {
        const normalized = normalizeTransportError(error)
        throw createHttpCallError(normalized, errorInput)
    }
}

export const callHttpEnvelope = async <
    TPath,
    TQuery,
    TBody,
    TData,
    TEnvelope extends HttpResultEnvelope<TData>,
    TError = unknown,
>(
    runtime: HttpRuntime,
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TEnvelope, TError>,
    requestInput: HttpCallInput<TPath, TQuery, TBody> | undefined,
    errorInput: HttpCallErrorInput,
): Promise<TData> => {
    let response: Awaited<ReturnType<HttpRuntime['call']>>
    try {
        response = await runtime.call(endpoint, requestInput)
    } catch (error) {
        const normalized = normalizeTransportError(error)
        throw createHttpCallError(normalized, errorInput)
    }

    const envelope = response.data as TEnvelope
    if (!envelope.success) {
        throw createEnvelopeError(
            envelope.error?.message ?? errorInput.fallbackMessage,
            envelope.error?.details,
            errorInput,
        )
    }

    return envelope.data
}
