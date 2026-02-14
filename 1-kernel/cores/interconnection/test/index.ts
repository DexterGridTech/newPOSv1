import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands, ScreenMode, storeEntry,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule, kernelCoreInterconnectionState} from "../src/index";


const appConfig: ApplicationConfig = {
    environment: {
        deviceId:"123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 2,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreInterconnectionModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)
    // console.log(store.getState())
    console.log(storeEntry.state(kernelCoreInterconnectionState.instanceInfo))

    // 执行命令
    kernelCoreBaseCommands.initialize().executeInternally()
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})