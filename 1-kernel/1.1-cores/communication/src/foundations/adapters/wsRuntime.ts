import {SocketConnectionError} from '../../types'
import type {
  SocketClientOptions,
  SocketFactory,
  SocketLike,
} from '../../types'
import type {ServerResolver} from '../shared/ServerResolver'
import {BaseSocketClient} from '../ws/BaseSocketClient'

export type SocketRuntimeName = 'node' | 'web' | 'react-native' | 'electron' | 'custom'

export interface SocketRuntimeAdapter {
  readonly runtimeName: SocketRuntimeName
  readonly supportsHeaders?: boolean
  readonly supportsBinary?: boolean
  createFactory(): SocketFactory
}

let registeredSocketRuntimeAdapter: SocketRuntimeAdapter | null = null

export const registerSocketRuntimeAdapter = (adapter: SocketRuntimeAdapter): void => {
  registeredSocketRuntimeAdapter = adapter
}

export const getRegisteredSocketRuntimeAdapter = (): SocketRuntimeAdapter | null => {
  return registeredSocketRuntimeAdapter
}

export const requireRegisteredSocketRuntimeAdapter = (): SocketRuntimeAdapter => {
  if (!registeredSocketRuntimeAdapter) {
    throw new SocketConnectionError('未注册 SocketRuntimeAdapter', {
      reason: 'SOCKET_RUNTIME_NOT_REGISTERED',
    })
  }
  return registeredSocketRuntimeAdapter
}

export const createRegisteredSocketFactory = (): SocketFactory => {
  return requireRegisteredSocketRuntimeAdapter().createFactory()
}

export function createRegisteredSocketClient<TIncoming = unknown, TOutgoing = unknown>(
  serverResolver: ServerResolver,
  options?: SocketClientOptions<TIncoming>,
): BaseSocketClient<TIncoming, TOutgoing> {
  const adapter = requireRegisteredSocketRuntimeAdapter()
  const socketFactory = adapter.createFactory()
  return new BaseSocketClient<TIncoming, TOutgoing>(serverResolver, socketFactory, options)
}

export interface BasicSocketRuntimeAdapterOptions {
  runtimeName?: SocketRuntimeName
  supportsHeaders?: boolean
  supportsBinary?: boolean
  socketCreator: (url: string, headers?: Record<string, string>) => SocketLike
}

export const createBasicSocketRuntimeAdapter = (
  options: BasicSocketRuntimeAdapterOptions,
): SocketRuntimeAdapter => {
  return {
    runtimeName: options.runtimeName ?? 'custom',
    supportsHeaders: options.supportsHeaders,
    supportsBinary: options.supportsBinary,
    createFactory(): SocketFactory {
      return {
        create(url: string, headers?: Record<string, string>): SocketLike {
          return options.socketCreator(url, headers)
        },
      }
    },
  }
}
