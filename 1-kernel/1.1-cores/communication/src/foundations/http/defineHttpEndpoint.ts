import type {CommunicationMeta, HttpEndpointDefinition, HttpMethod, TypeDescriptor} from '../../types'

export interface DefineHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError = unknown> {
  name: string
  serverName: string
  method: HttpMethod
  pathTemplate: string
  request?: {
    path?: TypeDescriptor<TPath>
    query?: TypeDescriptor<TQuery>
    body?: TypeDescriptor<TBody>
    headers?: TypeDescriptor<Record<string, string>>
  }
  response?: TypeDescriptor<TResponse>
  error?: TypeDescriptor<TError>
  meta?: CommunicationMeta
}

export function defineHttpEndpoint<TPath, TQuery, TBody, TResponse, TError = unknown>(
  input: DefineHttpEndpointInput<TPath, TQuery, TBody, TResponse, TError>,
): HttpEndpointDefinition<TPath, TQuery, TBody, TResponse, TError> {
  return {
    protocol: 'http',
    name: input.name,
    serverName: input.serverName,
    method: input.method,
    pathTemplate: input.pathTemplate,
    request: input.request ?? {},
    response: input.response ?? {kind: 'type-descriptor', name: `${input.name}.response`},
    error: input.error,
    meta: input.meta ?? {},
  }
}
