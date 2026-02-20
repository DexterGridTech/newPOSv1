import {ApplicationConfig, ApplicationManager, ScreenMode} from "@impos2/kernel-core-base";
import {assemblyAndroidDesktopModule} from "./index.ts";

const appConfig: ApplicationConfig = {
    environment: {
        deviceId:"123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: assemblyAndroidDesktopModule,
}
// 导出 Promise 供 App 组件等待
export const storePromise = ApplicationManager.getInstance().generateStore(appConfig).then(result => {
    console.log("生成devStore");
    return result;
});
