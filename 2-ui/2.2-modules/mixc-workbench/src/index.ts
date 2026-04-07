import {moduleName} from "./moduleName";
import {uiMixcWorkbenchSlice} from "./features/slices";
import {uiMixcWorkbenchActors} from "./features/actors";
import {uiMixcWorkbenchCommands} from "./features/commands";
import {uiMixcWorkbenchModulePreSetup} from "./application/modulePreSetup";
import {uiMixcWorkbenchErrorMessages} from "./supports/errors";
import {uiMixcWorkbenchParameters} from "./supports/parameters";
import {uiMixcWorkbenchEpics} from "./features/epics";
import {uiMixcWorkbenchMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcWorkbenchScreenParts} from "./ui";
import {packageVersion} from './generated/packageVersion';

export const uiMixcWorkbenchModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: uiMixcWorkbenchSlice,
    middlewares: uiMixcWorkbenchMiddlewares,
    epics: uiMixcWorkbenchEpics,
    commands: uiMixcWorkbenchCommands,
    actors: uiMixcWorkbenchActors,
    errorMessages: uiMixcWorkbenchErrorMessages,
    parameters: uiMixcWorkbenchParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiMixcWorkbenchModulePreSetup,
    screenParts:uiMixcWorkbenchScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./ui";
export {uiMixcWorkbenchSlice} from "./features/slices";
export {uiMixcWorkbenchCommands} from "./features/commands";
export {uiMixcWorkbenchErrorMessages} from "./supports/errors";
export {uiMixcWorkbenchParameters} from "./supports/parameters";
export {uiMixcWorkbenchApis} from "./supports";