import type {Response} from 'express'

export const ok = <T>(res: Response, data: T) => res.json({success: true, data})

export const created = <T>(res: Response, data: T) => res.status(201).json({success: true, data})

export const fail = (res: Response, message: string, status = 400, details?: unknown) =>
  res.status(status).json({success: false, error: {message, details}})
