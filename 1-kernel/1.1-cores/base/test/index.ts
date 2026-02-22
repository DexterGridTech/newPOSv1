import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseModule,
    ScreenMode, ServerSpace,
} from "../src/index"
export const dev :ServerSpace={
    selectedSpace:'dev',
    spaces:[
        {
            name:'dev',
            serverAddresses:[]
        }
    ]
}


const appConfig: ApplicationConfig = {
    serverSpace: dev,
    environment: {
        deviceId: "123",
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
    // 执行命令
    kernelCoreBaseCommands.initialize().execute("123")
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})