
import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    kernelCoreBaseModule,
    ScreenMode
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {kernelTerminalModule} from "../src";
// @ts-ignore
import {devServerSpace} from "@impos2/kernel-server-config";


const appConfig: ApplicationConfig = {
    serverSpace: devServerSpace,
    environment: {
        deviceId:"test id",
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