import { ApplicationConfig, ApplicationManager, ScreenMode } from '@impos2/kernel-core-base'
import { adapterElectronModule } from '../src'
import { devServerSpace } from '@impos2/kernel-server-config'

export const storePromise = () => {
    const appConfig: ApplicationConfig = {
        serverSpace: devServerSpace,
        environment: {
            deviceId: 'electron-dev',
            production: false,
            screenMode: ScreenMode.DESKTOP,
            displayCount: 1,
            displayIndex: 0,
        },
        preInitiatedState: {},
        module: adapterElectronModule,
    }
    return ApplicationManager.getInstance().generateStore(appConfig)
}
