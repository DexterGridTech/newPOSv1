import {moduleName} from "./moduleName";
import {uiMixcUserSlice} from "./features/slices";
import {uiMixcUserActors} from "./features/actors";
import {uiMixcUserCommands} from "./features/commands";
import {uiMixcUserModulePreSetup} from "./application/modulePreSetup";
import {uiMixcUserErrorMessages} from "./supports/errors";
import {uiMixcUserParameters} from "./supports/parameters";
import {uiMixcUserEpics} from "./features/epics";
import {uiMixcUserMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcUserScreenParts} from "./ui";
import {kernelUserBaseModule} from "@impos2/kernel-user-base";

export const uiMixcUserModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiMixcUserSlice,
    middlewares: uiMixcUserMiddlewares,
    epics: uiMixcUserEpics,
    commands: uiMixcUserCommands,
    actors: uiMixcUserActors,
    errorMessages: uiMixcUserErrorMessages,
    parameters: uiMixcUserParameters,
    dependencies: [
        kernelCoreNavigationModule,
        kernelUserBaseModule
    ],
    modulePreSetup: uiMixcUserModulePreSetup,
    screenParts:uiMixcUserScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./ui/moduleScreenParts";
export {uiMixcUserSlice} from "./features/slices";
export {uiMixcUserCommands} from "./features/commands";
export {uiMixcUserErrorMessages} from "./supports/errors";
export {uiMixcUserParameters} from "./supports/parameters";
export {uiMixcUserApis} from "./supports";