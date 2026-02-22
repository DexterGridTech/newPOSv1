import {ApplicationConfig, ApplicationManager} from "@impos2/kernel-core-base";
import {assemblyAndroidDesktopModule} from "./index.ts";
import {AppProps} from "./types/shared/appProps.ts";
import reactotron from "./foundations/reactotronConfig.ts";
import {devServerSpace, productServerSpace} from "@impos2/kernel-server-config";


// 导出 Promise 供 App 组件等待
export const storePromise = async (props: AppProps) => {
    const appConfig: ApplicationConfig = {
        serverSpace: __DEV__?devServerSpace:productServerSpace,
        environment: {
            deviceId: props.deviceId,
            production: !__DEV__,
            screenMode: props.screenMode,
            displayCount: props.displayCount,
            displayIndex: props.displayIndex,
        },
        preInitiatedState: {},
        module: assemblyAndroidDesktopModule,
        reactotronEnhancer: __DEV__ ? reactotron.createEnhancer!() : undefined
    }
    return ApplicationManager.getInstance().generateStore(appConfig)
}
