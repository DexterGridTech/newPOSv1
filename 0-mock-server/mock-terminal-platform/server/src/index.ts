import { createApp } from './app/createApp.js'
import { initializeDatabase } from './database/index.js'
import { createHttpAndWsServer } from './modules/tdp/wsServer.js'
import { startTdpChangeLogRetentionScheduler } from './modules/tdp/retentionScheduler.js'
import { APP_NAME, SERVER_PORT } from './shared/constants.js'

initializeDatabase()
startTdpChangeLogRetentionScheduler()

const app = createApp()
const server = createHttpAndWsServer(app)
server.listen(SERVER_PORT, () => {
  console.log(`${APP_NAME} server listening on http://127.0.0.1:${SERVER_PORT}`)
})
