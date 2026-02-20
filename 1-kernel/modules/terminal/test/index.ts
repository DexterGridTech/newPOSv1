
import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseModule,
    ScreenMode
    // @ts-ignore
} from "@impos2/kernel-core-base-v1";
import {kernelTerminalModule} from "../src";


const appConfig: ApplicationConfig = {
    environment: {
        deviceId:"123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelTerminalModule
}

async function initializeApp() {
    const {store} = await ApplicationManager.getInstance().generateStore(appConfig)
    kernelCoreBaseCommands.initialize().executeInternally()
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})