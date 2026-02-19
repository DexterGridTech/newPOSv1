import {AppModule, InitLogger} from "@impos2/kernel-core-base-v1";
import {registerScreenPart} from "./screens";

export const registerScreenParts = (allModules: AppModule[]) => {
    const initLogger = InitLogger.getInstance()
    const names: string[] = []
    allModules.forEach(module => {
        if (module.screenParts) {
            Object.values(module.screenParts).forEach(screenPart => {
                registerScreenPart(screenPart)
                names.push(screenPart.partKey)
            })
        }
    })
    initLogger.logDetail('Screen Parts', names.length.toString())
    initLogger.logNames(names)
}