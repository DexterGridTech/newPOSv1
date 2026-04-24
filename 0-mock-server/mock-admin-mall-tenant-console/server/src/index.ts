import {createApp} from './app/createApp.js'
import {initializeDatabase} from './database/index.js'
import {initializeAlignedMasterData} from './modules/aligned-master-data/service.js'
import {APP_NAME, SERVER_PORT} from './shared/constants.js'

initializeDatabase()
initializeAlignedMasterData()

const app = createApp()
app.listen(SERVER_PORT, () => {
  console.log(`${APP_NAME} server listening on http://127.0.0.1:${SERVER_PORT}`)
})
