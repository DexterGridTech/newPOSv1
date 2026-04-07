import type {SocketConnectionMeta, SocketConnectionProfile, TypeDescriptor} from '../../types'

export interface DefineSocketProfileInput<TQuery, THeaders, TIncoming, TOutgoing> {
  name: string
  serverName: string
  pathTemplate: string
  handshake?: {
    query?: TypeDescriptor<TQuery>
    headers?: TypeDescriptor<THeaders>
  }
  messages?: {
    incoming?: TypeDescriptor<TIncoming>
    outgoing?: TypeDescriptor<TOutgoing>
  }
  meta?: SocketConnectionMeta
}

export function defineSocketProfile<TQuery, THeaders, TIncoming, TOutgoing>(
  input: DefineSocketProfileInput<TQuery, THeaders, TIncoming, TOutgoing>,
): SocketConnectionProfile<TQuery, THeaders, TIncoming, TOutgoing> {
  return {
    protocol: 'ws',
    name: input.name,
    serverName: input.serverName,
    pathTemplate: input.pathTemplate,
    handshake: input.handshake ?? {},
    messages: input.messages ?? {},
    meta: input.meta ?? {},
  }
}
