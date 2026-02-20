
import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    ScreenMode,
    storeEntry,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "../src/index";


const appConfig: ApplicationConfig = {
    environment: {
        deviceId: "123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreNavigationModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)

    // 执行命令
    kernelCoreBaseCommands.initialize().executeInternally()
    console.log('----------------')

    setTimeout(() => {
        console.log('===================')
        console.log(JSON.stringify(storeEntry.getState()))
    }, 4000)
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})