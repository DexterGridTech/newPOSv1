import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseState,
    ScreenMode, ServerSpace,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {
    kernelCoreInterconnectionInstanceState,
    kernelCoreInterconnectionModule,
    kernelCoreInterconnectionState
} from "../src/index";

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
        displayCount: 2,
        displayIndex: 1
    },
    preInitiatedState: {},
    module: kernelCoreInterconnectionModule
}

async function initializeApp() {
    await ApplicationManager.getInstance().generateStore(appConfig)
    ApplicationManager.getInstance().init()
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})