import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseState,
    ScreenMode,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {
    kernelCoreInterconnectionInstanceState,
    kernelCoreInterconnectionModule,
    kernelCoreInterconnectionState
} from "../src/index";


const appConfig: ApplicationConfig = {
    environment: {
        deviceId: "123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 2,
        displayIndex: 1
    },
    preInitiatedState: {},
    module: kernelCoreInterconnectionModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)
    // 执行命令
    kernelCoreBaseCommands.initialize().executeInternally()

    // setTimeout(() => {
    //     const requestId = "456"
    //     // 订阅 store 变化，打印 requestStatus
    //     store.subscribe(() => {
    //         const state = store.getState()
    //         const requestStatus = state[`${kernelCoreInterconnectionInstanceState.requestStatus}.slave`][requestId]
    //         console.log('requestStatus 变化:', requestStatus)
    //     })
    //     console.log('-------------------')
    //     // 执行命令
    //     // kernelCoreInterconnectionCommands.test().execute(requestId)
    //     console.log('===================')
    // }, 10000)
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})