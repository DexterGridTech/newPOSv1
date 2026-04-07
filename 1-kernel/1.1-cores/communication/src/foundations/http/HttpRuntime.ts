import type {HttpCallInput, HttpEndpointDefinition, HttpRuntimeConfig} from '../../types'
import {ServerResolver} from '../shared/ServerResolver'
import {AxiosHttpTransport} from './AxiosHttpTransport'
import {HttpClient} from './HttpClient'

export class HttpRuntime {
  readonly serverResolver: ServerResolver
  readonly transport: AxiosHttpTransport
  readonly client: HttpClient
  private readonly config: HttpRuntimeConfig

  constructor(config: HttpRuntimeConfig) {
    this.config = config
    this.serverResolver = new ServerResolver()
    this.transport = new AxiosHttpTransport()
    this.client = new HttpClient(this.serverResolver, this.transport, {
      unwrapEnvelope: config.unwrapEnvelope,
      executionPolicy: config.executionPolicy,
      metricsRecorder: config.metricsRecorder,
    })
  }

  call<TPath, TQuery, TBody, TResponse, TError = unknown>(
    endpoint: HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError>,
    input: HttpCallInput<TPath, TQuery, TBody>,
  ): Promise<TResponse> {
    this.refreshServers()
    return this.client.call(endpoint, input)
  }

  private refreshServers(): void {
    const servers = this.config.servers ?? this.config.serverConfigProvider?.() ?? []
    this.serverResolver.clear()
    servers.forEach(server => this.serverResolver.registerServer(server))
  }
}
