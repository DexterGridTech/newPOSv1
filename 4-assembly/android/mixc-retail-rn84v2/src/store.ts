import {ApplicationConfig, ApplicationManager} from "@impos2/kernel-core-base";
import {StoreEnhancer} from "@reduxjs/toolkit";
import {assemblyAndroidMixcRetailModule} from "./index.ts";
import {AppProps} from "./types/shared/appProps.ts";
import {getReactotron} from "./foundations/reactotronConfig.ts";
import {devServerSpace, productServerSpace} from "@impos2/kernel-server-config";


// 导出 Promise 供 App 组件等待
export const storePromise = async (props: AppProps) => {
    if (__DEV__) {
        console.info(
            `[Store] init displayIndex=${props.displayIndex} isEmulator=${props.isEmulator} deviceId=${props.deviceId}`,
        )
    }
    const reactotron = __DEV__
        ? getReactotron({
            isEmulator: props.isEmulator,
            displayIndex: props.displayIndex,
            deviceId: props.deviceId,
        })
        : undefined
    const reactotronEnhancer = reactotron
        ? (reactotron as typeof reactotron & {createEnhancer?: () => StoreEnhancer}).createEnhancer?.()
        : undefined
    const appConfig: ApplicationConfig = {
        serverSpace: __DEV__?devServerSpace:productServerSpace,
        environment: {
            deviceId: props.deviceId,
            production: !__DEV__,
            screenMode: props.screenMode,
            displayCount: props.displayCount,
            displayIndex: props.displayIndex,
            isEmulator: props.isEmulator,
        },
        preInitiatedState: {},
        module: assemblyAndroidMixcRetailModule,
        reactotronEnhancer,
    }
    return ApplicationManager.getInstance().generateStore(appConfig)
}
