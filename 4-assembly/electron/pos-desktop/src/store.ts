import { ApplicationConfig, ApplicationManager, ScreenMode } from '@impos2/kernel-core-base'
import { assemblyElectronDesktopModule } from './index'
import { devServerSpace, productServerSpace } from '@impos2/kernel-server-config'

export const storePromise = async () => {
    const isDev = process.env.NODE_ENV !== 'production'
    const appConfig: ApplicationConfig = {
        serverSpace: isDev ? devServerSpace : productServerSpace,
        environment: {
            deviceId: 'electron-desktop',
            production: !isDev,
            screenMode: ScreenMode.DESKTOP,
            displayCount: 1,
            displayIndex: 0,
        },
        preInitiatedState: {},
        module: assemblyElectronDesktopModule,
    }
    return ApplicationManager.getInstance().generateStore(appConfig)
}
