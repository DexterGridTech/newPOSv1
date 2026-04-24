import type {NextFunction, Request, Response} from 'express'
import {createId} from './utils.js'
import type {PaginatedResult} from './pagination.js'

export interface RequestContext {
  traceId: string
  sandboxId: string
  idempotencyKey?: string
}

export interface ApiSuccessEnvelope<T> {
  success: true
  code: 0
  message: 'Success'
  timestamp: string
  trace_id: string
  traceId: string
  data: T
  pagination?: {
    page: number
    size: number
    total: number
    totalPages: number
  }
}

export interface ApiErrorEnvelope {
  success: false
  code: string
  message: string
  data: null
  timestamp: string
  trace_id: string
  traceId: string
  error: {
    message: string
    details?: unknown
  }
}

export class HttpError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const getRequestContext = (req: Request): RequestContext => {
  const traceId = typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : createId('trace')
  const sandboxId = typeof req.headers['x-sandbox-id'] === 'string' && req.headers['x-sandbox-id'].trim()
    ? req.headers['x-sandbox-id'].trim()
    : (typeof req.query.sandboxId === 'string' && req.query.sandboxId.trim() ? req.query.sandboxId.trim() : 'sandbox-kernel-base-test')
  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()
    ? req.headers['idempotency-key'].trim()
    : undefined
  return {traceId, sandboxId, idempotencyKey}
}

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const context = getRequestContext(req)
  res.locals.requestContext = context
  res.setHeader('x-trace-id', context.traceId)
  next()
}

const contextFromResponse = (res: Response): RequestContext =>
  (res.locals.requestContext ?? {
    traceId: createId('trace'),
    sandboxId: 'sandbox-kernel-base-test',
  }) as RequestContext

const createTimestamp = () => new Date().toISOString()

export const ok = <T>(res: Response, data: T, status = 200) => {
  const context = contextFromResponse(res)
  const body: ApiSuccessEnvelope<T> = {
    success: true,
    code: 0,
    message: 'Success',
    timestamp: createTimestamp(),
    trace_id: context.traceId,
    traceId: context.traceId,
    data,
  }
  return res.status(status).json(body)
}

export const created = <T>(res: Response, data: T) => ok(res, data, 201)

export const okPage = <T>(res: Response, page: PaginatedResult<T>) => {
  const context = contextFromResponse(res)
  const body: ApiSuccessEnvelope<T[]> = {
    success: true,
    code: 0,
    message: 'Success',
    timestamp: createTimestamp(),
    trace_id: context.traceId,
    traceId: context.traceId,
    data: page.items,
    pagination: {
      page: page.page,
      size: page.size,
      total: page.total,
      totalPages: page.totalPages,
    },
  }
  return res.status(200).json(body)
}

export const fail = (res: Response, message: string, status = 400, details?: unknown, code = 'BAD_REQUEST') => {
  const context = contextFromResponse(res)
  const body: ApiErrorEnvelope = {
    success: false,
    code,
    message,
    data: null,
    timestamp: createTimestamp(),
    trace_id: context.traceId,
    traceId: context.traceId,
    error: {
      message,
      details,
    },
  }
  return res.status(status).json(body)
}

export const wrapRoute = (
  handler: (req: Request, res: Response) => Promise<unknown> | unknown,
) => async (req: Request, res: Response) => {
  try {
    await handler(req, res)
  } catch (error) {
    if (error instanceof HttpError) {
      fail(res, error.message, error.status, error.details, error.code)
      return
    }
    fail(res, error instanceof Error ? error.message : 'UNEXPECTED_ERROR', 500, undefined, 'INTERNAL_ERROR')
  }
}
