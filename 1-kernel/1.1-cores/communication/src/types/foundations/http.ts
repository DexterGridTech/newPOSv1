import type {CommunicationMeta, CommunicationRequestContext, CommunicationServerConfig} from './shared'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface TypeDescriptor<T> {
  readonly kind: 'type-descriptor'
  readonly name?: string
  validate?: (value: unknown) => value is T
}

export interface HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError = unknown> {
  readonly protocol: 'http'
  readonly name: string
  readonly serverName: string
  readonly method: HttpMethod
  readonly pathTemplate: string
  readonly request: {
    readonly path?: TypeDescriptor<TPath>
    readonly query?: TypeDescriptor<TQuery>
    readonly body?: TypeDescriptor<TBody>
    readonly headers?: TypeDescriptor<Record<string, string>>
  }
  readonly response: TypeDescriptor<TResponse>
  readonly error?: TypeDescriptor<TError>
  readonly meta: CommunicationMeta
}

export interface HttpCallInput<TPath, TQuery, TBody> {
  path?: TPath
  query?: TQuery
  body?: TBody
  headers?: Record<string, string>
  context?: CommunicationRequestContext
}

export interface HttpSuccessResponse<TResponse> {
  data: TResponse
  status: number
  statusText: string
  headers: Record<string, string>
}

export interface HttpAddressSelection {
  addressName: string
  baseURL: string
  timeoutMs?: number
}

export interface HttpTransportRequest<TPath, TQuery, TBody> {
  endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, unknown>
  input: HttpCallInput<TPath, TQuery, TBody>
  url: string
  timeoutMs?: number
  selectedAddress: HttpAddressSelection
  attemptIndex: number
  roundIndex: number
}

export interface HttpTransport {
  execute<TPath, TQuery, TBody, TResponse>(
    request: HttpTransportRequest<TPath, TQuery, TBody>,
  ): Promise<HttpSuccessResponse<TResponse>>
}

export interface HttpAttemptMetric {
  attemptIndex: number
  roundIndex: number
  addressName: string
  baseURL: string
  durationMs: number
  success: boolean
  errorCode?: string
  errorMessage?: string
}

export interface HttpCallMetric {
  endpointName: string
  serverName: string
  method: HttpMethod
  pathTemplate: string
  startedAt: number
  endedAt: number
  durationMs: number
  success: boolean
  attempts: HttpAttemptMetric[]
}

export interface HttpMetricsRecorder {
  recordCall(metric: HttpCallMetric): void
}

export interface HttpExecutionPolicy {
  maxConcurrent?: number
  rateLimitWindowMs?: number
  rateLimitMaxRequests?: number
}

export interface HttpRuntimeConfig {
  servers?: CommunicationServerConfig[]
  serverConfigProvider?: () => CommunicationServerConfig[]
  unwrapEnvelope?: boolean
  executionPolicy?: HttpExecutionPolicy
  metricsRecorder?: HttpMetricsRecorder
}

export interface HttpServiceModuleDefinition<TServices> {
  moduleName: string
  services: TServices
}
