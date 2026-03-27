import {ApplicationConfig, ApplicationManager, ScreenMode} from "@impos2/kernel-core-base";
import {adapterTauriModule} from "../src";
import {devServerSpace} from "@impos2/kernel-server-config";

export const storePromise = () => {
    const appConfig: ApplicationConfig = {
        serverSpace: devServerSpace,
        environment: {
            deviceId: "test id",
            production: false,
            screenMode: ScreenMode.DESKTOP,
            displayCount: 1,
            displayIndex: 0
        },
        preInitiatedState: {},
        module: adapterTauriModule,
    }
    return ApplicationManager.getInstance().generateStore(appConfig);
};
