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
        deviceId:"test id",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreBaseModule
}

async function initializeApp() {
    await ApplicationManager.getInstance().generateStore(appConfig)
    ApplicationManager.getInstance().init()
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})