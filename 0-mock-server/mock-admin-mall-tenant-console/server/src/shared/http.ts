import type {NextFunction, Request, Response} from 'express'
import {createId} from './utils.js'
import type {PaginatedResult} from './pagination.js'

export interface RequestContext {
  traceId: string
  sandboxId: string
  clientIp?: string
  userAgent?: string
  idempotencyKey?: string
  expectedRevision?: number
  actorType?: string
  actorId?: string
  targetTerminalIds?: string[]
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

const firstHeader = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value

const bodyRecord = (req: Request): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {}

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

const firstNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

const stringArray = (value: unknown) => Array.isArray(value)
  ? value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean)
  : undefined

export const getRequestContext = (req: Request): RequestContext => {
  const body = bodyRecord(req)
  const traceId = typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : createId('trace')
  const sandboxId = typeof req.headers['x-sandbox-id'] === 'string' && req.headers['x-sandbox-id'].trim()
    ? req.headers['x-sandbox-id'].trim()
    : (typeof req.query.sandboxId === 'string' && req.query.sandboxId.trim() ? req.query.sandboxId.trim() : 'sandbox-kernel-base-test')
  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key'].trim()
    ? req.headers['idempotency-key'].trim()
    : undefined
  const expectedRevision = firstNumber(
    firstHeader(req.headers['x-expected-revision']),
    req.query.expectedRevision,
    body.expectedRevision,
    body.sourceRevision,
  )
  const targetTerminalIds = stringArray(body.targetTerminalIds)
  return {
    traceId,
    sandboxId,
    clientIp: firstString(firstHeader(req.headers['x-forwarded-for']), req.socket.remoteAddress),
    userAgent: firstString(firstHeader(req.headers['user-agent'])),
    idempotencyKey,
    expectedRevision,
    actorType: firstString(firstHeader(req.headers['x-actor-type']), body.actorType),
    actorId: firstString(firstHeader(req.headers['x-actor-id']), body.actorId),
    targetTerminalIds,
  }
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
