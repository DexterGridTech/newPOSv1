import {
  ApplicationConfig,
  ApplicationManager,
  kernelCoreBaseCommands,
  kernelCoreBaseModule,
  kernelCoreBaseState,
  ScreenMode,
} from '@impos2/kernel-core-base'
import {devServerSpace} from '@impos2/kernel-server-config'
import {kernelMixcUserLoginModule} from '../src'

const appConfig: ApplicationConfig = {
  environment: {
    deviceId: '123',
    production: false,
    screenMode: ScreenMode.DESKTOP,
    displayCount: 1,
    displayIndex: 0,
  },
  preInitiatedState: {},
  module: kernelMixcUserLoginModule,
  serverSpace: devServerSpace,
}

async function initializeApp() {
  const {store} = await ApplicationManager.getInstance().generateStore(appConfig)
  const requestId = 'mixc-user-login-dev'

  store.subscribe(() => {
    const state = store.getState()
    const requestStatusMap = state[kernelCoreBaseState.requestStatus]
    const requestStatus = requestStatusMap?.[requestId]
    if (requestStatus) {
      console.log('requestStatus 变化:', requestStatus)
    }
  })

  console.log('-------------------')
  kernelCoreBaseCommands.initialize().execute(requestId)
  console.log('mixc-user-login dev 初始化完成')
  console.log('===================')
}

initializeApp().catch(error => {
  console.error('Failed to initialize mixc-user-login app:', error)
})
