import {APIError, APIResponseCode} from '@impos2/kernel-core-base'
import {CommunicationError, HttpBusinessError, HttpTransportError} from '../../types'

export function normalizeCommunicationError(error: unknown): APIError {
  if (error instanceof APIError) {
    return error
  }

  if (error instanceof HttpBusinessError) {
    return new APIError({
      code: String(error.code),
      message: error.message,
      extra: {
        details: error.details,
      },
    })
  }

  if (error instanceof HttpTransportError) {
    return new APIError({
      code: APIResponseCode.NETWORK_ERROR,
      message: error.message,
      extra: {
        details: error.details,
      },
    })
  }

  if (error instanceof CommunicationError) {
    return new APIError({
      code: String(error.code),
      message: error.message,
      extra: {
        details: error.details,
      },
    })
  }

  return new APIError({
    code: APIResponseCode.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : 'unknown communication error',
  })
}
