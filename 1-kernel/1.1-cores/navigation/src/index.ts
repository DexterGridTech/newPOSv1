import {moduleName} from "./moduleName";
import {kernelCoreNavigationSlice} from "./features/slices";
import {kernelCoreNavigationActors} from "./features/actors";
import {kernelCoreNavigationCommands} from "./features/commands";
import {kernelCoreNavigationModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreNavigationErrorMessages} from "./supports/errors";
import {kernelCoreNavigationParameters} from "./supports/parameters";
import {kernelCoreNavigationEpics} from "./features/epics";
import {kernelCoreNavigationMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {packageVersion} from './generated/packageVersion';

export const kernelCoreNavigationModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelCoreNavigationSlice,
    middlewares: kernelCoreNavigationMiddlewares,
    epics: kernelCoreNavigationEpics,
    commands: kernelCoreNavigationCommands,
    actors: kernelCoreNavigationActors,
    errorMessages: kernelCoreNavigationErrorMessages,
    parameters: kernelCoreNavigationParameters,
    dependencies: [kernelCoreBaseModule, kernelCoreInterconnectionModule],
    modulePreSetup: kernelCoreNavigationModulePreSetup,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelCoreNavigationSlice} from "./features/slices";
export {kernelCoreNavigationCommands} from "./features/commands";
export {kernelCoreNavigationErrorMessages} from "./supports/errors";
export {kernelCoreNavigationParameters} from "./supports/parameters";
export {kernelCoreNavigationApis} from "./supports";