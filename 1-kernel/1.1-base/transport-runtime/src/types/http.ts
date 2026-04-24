import type {AppError, TimestampMs} from '@next/kernel-base-contracts'
import type {LoggerPort} from '@next/kernel-base-platform-ports'
import type {
    ServerCatalog,
    TransportRequestContext,
    TransportServerAddress,
    TransportServerDefinition,
} from './transport'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface TypeDescriptor<T> {
    readonly kind: 'type-descriptor'
    readonly name?: string
    readonly validate?: (value: unknown) => value is T
}

export interface HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError = unknown> {
    readonly protocol: 'http'
    readonly name: string
    readonly serverName: string
    readonly method: HttpMethod
    readonly pathTemplate: string
    readonly timeoutMs?: number
    readonly request: {
        readonly path?: TypeDescriptor<TPath>
        readonly query?: TypeDescriptor<TQuery>
        readonly body?: TypeDescriptor<TBody>
        readonly headers?: TypeDescriptor<Record<string, string>>
    }
    readonly response: TypeDescriptor<TResponse>
    readonly error?: TypeDescriptor<TError>
    readonly meta?: Record<string, unknown>
}

export interface HttpCallInput<TPath, TQuery, TBody> {
    readonly path?: TPath
    readonly query?: TQuery
    readonly body?: TBody
    readonly headers?: Record<string, string>
    readonly context?: TransportRequestContext
}

export interface HttpSuccessResponse<TResponse> {
    readonly data: TResponse
    readonly status: number
    readonly statusText: string
    readonly headers: Record<string, string>
}

export interface HttpTransportRequest<TPath, TQuery, TBody> {
    readonly endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, unknown>
    readonly input: HttpCallInput<TPath, TQuery, TBody>
    readonly url: string
    readonly timeoutMs?: number
    readonly selectedAddress: TransportServerAddress
    readonly attemptIndex: number
    readonly roundIndex: number
}

export interface HttpTransport {
    execute<TPath, TQuery, TBody, TResponse>(
        request: HttpTransportRequest<TPath, TQuery, TBody>,
    ): Promise<HttpSuccessResponse<TResponse>>
}

export interface HttpAttemptMetric {
    readonly attemptIndex: number
    readonly roundIndex: number
    readonly addressName: string
    readonly baseUrl: string
    readonly startedAt: TimestampMs
    readonly endedAt: TimestampMs
    readonly durationMs: number
    readonly success: boolean
    readonly errorCode?: string
    readonly errorMessage?: string
}

export interface HttpCallMetric {
    readonly endpointName: string
    readonly serverName: string
    readonly method: HttpMethod
    readonly pathTemplate: string
    readonly startedAt: TimestampMs
    readonly endedAt: TimestampMs
    readonly durationMs: number
    readonly success: boolean
    readonly attempts: readonly HttpAttemptMetric[]
}

export interface HttpMetricsRecorder {
    recordCall(metric: HttpCallMetric): void
}

export interface HttpExecutionPolicy {
    readonly maxConcurrent?: number
    readonly rateLimitWindowMs?: number
    readonly rateLimitMaxRequests?: number
    readonly retryRounds?: number
    readonly failoverStrategy?: 'ordered' | 'single-address'
    readonly shouldRetry?: (error: unknown, request: HttpTransportRequest<any, any, any>) => boolean
}

export interface CreateHttpRuntimeInput {
    readonly logger: LoggerPort
    readonly transport: HttpTransport
    readonly servers?: readonly TransportServerDefinition[]
    readonly serverProvider?: () => readonly TransportServerDefinition[]
    readonly executionPolicy?: HttpExecutionPolicy
    readonly metricsRecorder?: HttpMetricsRecorder
}

export interface HttpRuntime {
    call<TPath, TQuery, TBody, TResponse, TError = unknown>(
        endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
        input?: HttpCallInput<TPath, TQuery, TBody>,
    ): Promise<HttpSuccessResponse<TResponse>>
    replaceServers(servers: readonly TransportServerDefinition[]): void
    getServerCatalog(): ServerCatalog
}

export interface HttpFailureDetails {
    readonly endpointName: string
    readonly serverName: string
    readonly attempts: readonly HttpAttemptMetric[]
    readonly cause?: unknown
}

export interface HttpRuntimeFailure extends AppError {
    readonly details?: HttpFailureDetails
}
