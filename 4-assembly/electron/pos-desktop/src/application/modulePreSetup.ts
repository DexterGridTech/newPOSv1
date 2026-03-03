import { ApplicationConfig, AppModule, InitLogger, registerAppControl } from '@impos2/kernel-core-base'
import { appControlAdapter } from '../foundations'

export const assemblyElectronDesktopModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    initLogger.logNames(['register app control'])
    registerAppControl(appControlAdapter)
}
