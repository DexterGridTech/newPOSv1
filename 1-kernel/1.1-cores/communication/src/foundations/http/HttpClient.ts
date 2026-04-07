import {CommunicationError, HttpBusinessError, HttpTransportError} from '../../types'
import type {
  HttpAttemptMetric,
  HttpCallInput,
  HttpCallMetric,
  HttpEndpointDefinition,
  HttpExecutionPolicy,
  HttpMetricsRecorder,
  HttpSuccessResponse,
  HttpTransport,
} from '../../types'
import {ServerResolver} from '../shared/ServerResolver'
import {buildHttpUrl} from './buildHttpUrl'
import {HttpExecutionController} from './HttpExecutionController'

export interface HttpEnvelopeLike<TResponse = unknown> {
  code?: string
  message?: string
  data?: TResponse
}

export interface HttpClientOptions {
  unwrapEnvelope?: boolean
  metricsRecorder?: HttpMetricsRecorder
  executionPolicy?: HttpExecutionPolicy
}

export class HttpClient {
  private readonly executionController: HttpExecutionController

  constructor(
    private readonly serverResolver: ServerResolver,
    private readonly transport: HttpTransport,
    private readonly options: HttpClientOptions = {unwrapEnvelope: false},
  ) {
    this.executionController = new HttpExecutionController(options.executionPolicy)
  }

  async call<TPath, TQuery, TBody, TResponse, TError = unknown>(
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    input: HttpCallInput<TPath, TQuery, TBody>,
  ): Promise<TResponse> {
    return this.executionController.run(() => this.executeCall(endpoint, input))
  }

  getExecutionStats() {
    return this.executionController.getStats()
  }

  private async executeCall<TPath, TQuery, TBody, TResponse, TError = unknown>(
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    input: HttpCallInput<TPath, TQuery, TBody>,
  ): Promise<TResponse> {
    const serverConfig = this.serverResolver.resolve(endpoint.serverName)
    const retryRounds = Math.max(0, endpoint.meta.retry ?? serverConfig.retryCount ?? 0)
    const startedAt = Date.now()
    const attempts: HttpAttemptMetric[] = []
    let attemptIndex = 0
    let lastError: unknown

    for (let roundIndex = 0; roundIndex <= retryRounds; roundIndex += 1) {
      for (const address of serverConfig.addresses) {
        attemptIndex += 1
        this.throwIfAborted(input)
        const attemptStartedAt = Date.now()
        try {
          const url = buildHttpUrl(
            address.baseURL,
            endpoint.pathTemplate,
            input.path as Record<string, unknown> | undefined,
            input.query as Record<string, unknown> | undefined,
          )

          const response = await this.transport.execute<TPath, TQuery, TBody, TResponse>({
            endpoint,
            input,
            url,
            timeoutMs: endpoint.meta.timeoutMs ?? address.timeout,
            selectedAddress: {
              addressName: address.addressName,
              baseURL: address.baseURL,
              timeoutMs: address.timeout,
            },
            attemptIndex,
            roundIndex,
          })

          const data = this.unwrapResponse(endpoint, response)
          attempts.push({
            attemptIndex,
            roundIndex,
            addressName: address.addressName,
            baseURL: address.baseURL,
            durationMs: Date.now() - attemptStartedAt,
            success: true,
          })
          this.recordMetric(endpoint, startedAt, attempts, true)
          return data
        } catch (error) {
          const normalizedError = this.normalizeError(error)
          attempts.push({
            attemptIndex,
            roundIndex,
            addressName: address.addressName,
            baseURL: address.baseURL,
            durationMs: Date.now() - attemptStartedAt,
            success: false,
            errorCode: normalizedError.code,
            errorMessage: normalizedError.message,
          })
          lastError = normalizedError

          if (normalizedError instanceof HttpBusinessError) {
            this.recordMetric(endpoint, startedAt, attempts, false)
            throw normalizedError
          }

          this.throwIfAborted(input)
        }
      }

      if (roundIndex < retryRounds && serverConfig.retryInterval) {
        await delay(serverConfig.retryInterval)
      }
    }

    this.recordMetric(endpoint, startedAt, attempts, false)
    throw this.normalizeError(lastError)
  }

  private unwrapResponse<TResponse, TPath, TQuery, TBody, TError>(
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    response: HttpSuccessResponse<TResponse>,
  ): TResponse {
    if (!this.options.unwrapEnvelope) {
      return response.data
    }

    const payload = response.data as HttpEnvelopeLike<TResponse>
    if (payload.code && payload.code !== 'SUCCESS') {
      throw new HttpBusinessError(payload.message ?? `业务调用失败: ${endpoint.name}`, {
        endpoint: endpoint.name,
        payload,
      })
    }
    return (payload.data ?? response.data) as TResponse
  }

  private throwIfAborted<TPath, TQuery, TBody>(input: HttpCallInput<TPath, TQuery, TBody>) {
    if (input.context?.signal?.aborted) {
      throw new HttpTransportError('HTTP 请求已取消', {reason: input.context.signal.reason})
    }
  }

  private normalizeError(error: unknown): CommunicationError {
    if (error instanceof CommunicationError) {
      return error
    }
    return new HttpTransportError('HTTP 调用失败', {error})
  }

  private recordMetric<TPath, TQuery, TBody, TResponse, TError>(
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    startedAt: number,
    attempts: HttpAttemptMetric[],
    success: boolean,
  ): void {
    const endedAt = Date.now()
    const metric: HttpCallMetric = {
      endpointName: endpoint.name,
      serverName: endpoint.serverName,
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      success,
      attempts,
    }
    this.options.metricsRecorder?.recordCall(metric)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
