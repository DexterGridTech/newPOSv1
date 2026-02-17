import {ApplicationConfig, AppModule, InitLogger} from "@impos2/kernel-core-base";
import {registerScreenPart} from "../foundations/screens";


export const kernelCoreNavigationModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
    const initLogger = new InitLogger()
    logModulesAndScreenParts(initLogger, allModules)
    registerScreenParts(allModules)
}

const logModulesAndScreenParts = (initLogger: InitLogger, allModules: AppModule[]) => {
    initLogger.logStep(3.1, 'Navigation Pre-Setup: Modules & ScreenParts')

    let totalScreenParts = 0
    allModules.forEach((module, index) => {
        const screenParts = module.screenParts ? Object.values(module.screenParts) : []
        const screenPartCount = screenParts.length
        totalScreenParts += screenPartCount

        initLogger.logDetail(`[${index + 1}/${allModules.length}] ${module.name}`, `${screenPartCount} screenParts`)
        if (screenPartCount > 0) {
            initLogger.logNames(screenParts.map(sp => `${sp.name} (${sp.partKey})`))
        }
    })

    initLogger.logSuccess(`Found ${allModules.length} modules, ${totalScreenParts} screenParts registered`)
    initLogger.logStepEnd()
}

const registerScreenParts = (allModules: AppModule[]) => {
    allModules.forEach(module => {
        if (module.screenParts) {
            Object.values(module.screenParts).forEach(screenPart => {
                registerScreenPart(screenPart)
            })
        }
    })
}