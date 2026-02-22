
import {
    ApplicationConfig,
    ApplicationManager,
    kernelCoreBaseCommands,
    ScreenMode, ServerSpace,
    storeEntry,
    // @ts-ignore
} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule, kernelCoreInterconnectionState} from "../src/index";

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
        displayCount: 2,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: kernelCoreInterconnectionModule
}

async function initializeApp() {
    await ApplicationManager.getInstance().generateStore(appConfig)
    console.log(storeEntry.getStateByKey(kernelCoreInterconnectionState.instanceInfo))
    // 执行命令
    kernelCoreBaseCommands.initialize().executeInternally()
}

initializeApp().catch(error => {
    console.error('Failed to initialize app:', error)
})