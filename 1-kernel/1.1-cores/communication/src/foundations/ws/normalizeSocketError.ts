import {
  CommunicationError,
  SocketBootstrapError,
  SocketConnectionError,
  SocketParseError,
  SocketRuntimeError,
} from '../../types'

export function normalizeSocketError(error: unknown, fallbackMessage = 'Socket 调用失败'): CommunicationError {
  if (error instanceof CommunicationError) {
    return error
  }

  if (error instanceof SyntaxError) {
    return new SocketParseError(error.message, {error})
  }

  if (error instanceof Error) {
    return new SocketRuntimeError(error.message || fallbackMessage, {error})
  }

  return new SocketRuntimeError(fallbackMessage, {error})
}

export function toSocketConnectionError(error: unknown, message = 'Socket 连接失败'): SocketConnectionError {
  if (error instanceof SocketConnectionError) {
    return error
  }
  return new SocketConnectionError(message, {error})
}

export function toSocketBootstrapError(error: unknown, message = 'Socket bootstrap 失败'): SocketBootstrapError {
  if (error instanceof SocketBootstrapError) {
    return error
  }
  return new SocketBootstrapError(message, {error})
}
