import express from 'express'
import cors from 'cors'
import { createRouter } from '../modules/admin/routes.js'

export const createApp = () => {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '32mb' }))
  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } })
  })
  app.use(createRouter())
  return app
}
