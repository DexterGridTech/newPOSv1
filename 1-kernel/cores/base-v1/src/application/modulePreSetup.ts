import {ApplicationConfig, AppModule} from "./types";
import {logger} from "../foundations";
import {moduleName} from "../moduleName";
import {LOG_TAGS} from "../types";
export const kernelCoreBaseModulePreSetup = async (config: ApplicationConfig, allModules: AppModule[]) => {
logger.log([moduleName,LOG_TAGS.System, "preSetup"], 'pre setup called', [])
}