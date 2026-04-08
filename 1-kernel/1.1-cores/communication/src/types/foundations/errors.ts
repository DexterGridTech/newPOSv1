export type CommunicationErrorCode =
  | 'INVALID_PATH_TEMPLATE'
  | 'MISSING_PATH_PARAM'
  | 'SERVER_NOT_FOUND'
  | 'SERVER_HAS_NO_ADDRESS'
  | 'HTTP_TRANSPORT_ERROR'
  | 'HTTP_BUSINESS_ERROR'
  | 'SOCKET_CONFIGURATION_ERROR'
  | 'SOCKET_CONNECTION_ERROR'
  | 'SOCKET_RUNTIME_ERROR'
  | 'SOCKET_PARSE_ERROR'
  | 'SOCKET_BOOTSTRAP_ERROR'
  | 'NOT_IMPLEMENTED'

export class CommunicationError extends Error {
  constructor(
    public readonly code: CommunicationErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'CommunicationError'
  }
}

export class HttpTransportError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('HTTP_TRANSPORT_ERROR', message, details)
    this.name = 'HttpTransportError'
  }
}

export class HttpBusinessError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('HTTP_BUSINESS_ERROR', message, details)
    this.name = 'HttpBusinessError'
  }
}

export class SocketConnectionError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('SOCKET_CONNECTION_ERROR', message, details)
    this.name = 'SocketConnectionError'
  }
}

export class SocketRuntimeError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('SOCKET_RUNTIME_ERROR', message, details)
    this.name = 'SocketRuntimeError'
  }
}

export class SocketParseError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('SOCKET_PARSE_ERROR', message, details)
    this.name = 'SocketParseError'
  }
}

export class SocketBootstrapError extends CommunicationError {
  constructor(message: string, details?: unknown) {
    super('SOCKET_BOOTSTRAP_ERROR', message, details)
    this.name = 'SocketBootstrapError'
  }
}
