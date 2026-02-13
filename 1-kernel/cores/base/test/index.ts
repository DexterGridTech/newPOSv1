import {
    ApplicationManager,
    ApplicationConfig,
    kernelCoreBaseModule,
    kernelCoreBaseCommands, kernelCoreBaseState, ScreenMode,
} from "../src/index"


const appConfig: ApplicationConfig = {
    environment: {
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreBaseModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)

    const requestId = "123"

    // 订阅 store 变化，打印 requestStatus
    // store.subscribe(() => {
    //     const state = store.getState()
    //     const requestStatus = state[kernelCoreBaseState.requestStatus][requestId]
    //     console.log('requestStatus 变化:', requestStatus)
    // })

    // 执行命令
    kernelCoreBaseCommands.initialize().execute(requestId)
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})