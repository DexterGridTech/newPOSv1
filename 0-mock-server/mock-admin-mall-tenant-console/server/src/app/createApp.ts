import cors from 'cors'
import express from 'express'
import {createRouter} from '../modules/master-data/routes.js'

export const createApp = () => {
  const app = express()
  app.use(cors())
  app.use(express.json({limit: '32mb'}))
  app.use(createRouter())
  return app
}
