import cors from 'cors'
import express from 'express'
import {createAlignedRouter} from '../modules/aligned-master-data/routes.js'
import {createAssetRouter} from '../modules/assets/routes.js'
import {createRouter} from '../modules/master-data/routes.js'
import {requestContextMiddleware} from '../shared/http.js'

export const createApp = () => {
  const app = express()
  app.use(cors())
  app.use(express.json({limit: '32mb'}))
  app.use(requestContextMiddleware)
  app.use(createAssetRouter())
  app.use(createAlignedRouter())
  app.use(createRouter())
  return app
}
