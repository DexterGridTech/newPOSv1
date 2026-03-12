import {moduleName} from "./moduleName";
import {uiMixcActivitySlice} from "./features/slices";
import {uiMixcActivityActors} from "./features/actors";
import {uiMixcActivityCommands} from "./features/commands";
import {uiMixcActivityModulePreSetup} from "./application/modulePreSetup";
import {uiMixcActivityErrorMessages} from "./supports/errors";
import {uiMixcActivityParameters} from "./supports/parameters";
import {uiMixcActivityEpics} from "./features/epics";
import {uiMixcActivityMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcActivityScreenParts} from "./ui";

export const uiMixcActivityModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiMixcActivitySlice,
    middlewares: uiMixcActivityMiddlewares,
    epics: uiMixcActivityEpics,
    commands: uiMixcActivityCommands,
    actors: uiMixcActivityActors,
    errorMessages: uiMixcActivityErrorMessages,
    parameters: uiMixcActivityParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiMixcActivityModulePreSetup,
    screenParts:uiMixcActivityScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./ui/moduleScreenParts";
export {uiMixcActivitySlice} from "./features/slices";
export {uiMixcActivityCommands} from "./features/commands";
export {uiMixcActivityErrorMessages} from "./supports/errors";
export {uiMixcActivityParameters} from "./supports/parameters";
export {uiMixcActivityApis} from "./supports";