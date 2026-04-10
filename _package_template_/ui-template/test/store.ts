import {ApplicationConfig, ApplicationManager, ScreenMode} from "@impos2/kernel-core-base";
import {ui{{PACKAGE_NAME_PASCAL}}Module} from "../src";
import {devServerSpace} from "@impos2/kernel-server-config";

const appConfig: ApplicationConfig = {
    environment: {
        deviceId:"123",
        production: false,
        screenMode: ScreenMode.DESKTOP,
        displayCount: 1,
        displayIndex: 0
    },
    preInitiatedState: {},
    module: ui{{PACKAGE_NAME_PASCAL}}Module,
    serverSpace:devServerSpace,
}
export const storePromise = ApplicationManager.getInstance().generateStore(appConfig).then(result => {
    console.log("生成testStore");
    return result;
});
