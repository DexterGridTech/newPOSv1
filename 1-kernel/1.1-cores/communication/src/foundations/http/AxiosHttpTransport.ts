import axios, {AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios'
import {HttpTransportError} from '../../types'
import type {HttpSuccessResponse, HttpTransport, HttpTransportRequest} from '../../types'

export class AxiosHttpTransport implements HttpTransport {
  private readonly axiosInstance: AxiosInstance

  constructor(axiosInstance?: AxiosInstance) {
    this.axiosInstance = axiosInstance ?? axios.create()
  }

  addRequestInterceptor(
    onFulfilled?: ((value: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>) | null,
    onRejected?: ((error: unknown) => unknown) | null,
  ): number {
    return this.axiosInstance.interceptors.request.use(onFulfilled ?? undefined, onRejected ?? undefined)
  }

  removeRequestInterceptor(interceptorId: number): void {
    this.axiosInstance.interceptors.request.eject(interceptorId)
  }

  addResponseInterceptor<T = unknown>(
    onFulfilled?: ((value: AxiosResponse<T>) => AxiosResponse<T> | Promise<AxiosResponse<T>>) | null,
    onRejected?: ((error: unknown) => unknown) | null,
  ): number {
    return this.axiosInstance.interceptors.response.use(onFulfilled ?? undefined, onRejected ?? undefined)
  }

  removeResponseInterceptor(interceptorId: number): void {
    this.axiosInstance.interceptors.response.eject(interceptorId)
  }

  async execute<TPath, TQuery, TBody, TResponse>(
    request: HttpTransportRequest<TPath, TQuery, TBody>,
  ): Promise<HttpSuccessResponse<TResponse>> {
    try {
      const response = await this.axiosInstance.request<TResponse>({
        url: request.url,
        method: request.endpoint.method,
        headers: {
          ...(request.input.headers ?? {}),
          ...(request.input.context?.extraHeaders ?? {}),
        },
        data: request.input.body,
        timeout: request.timeoutMs,
        signal: request.input.context?.signal,
        validateStatus: () => true,
      })

      if (response.status >= 400) {
        throw new HttpTransportError(`HTTP 响应状态异常: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          request,
        })
      }

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: normalizeHeaders(response.headers as Record<string, unknown>),
      }
    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw error
      }
      throw new HttpTransportError('HTTP 请求执行失败', {error, request})
    }
  }
}

function normalizeHeaders(headers: Record<string, unknown>): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>((result, [key, value]) => {
    if (value === undefined || value === null) {
      return result
    }
    result[key] = String(value)
    return result
  }, {})
}
