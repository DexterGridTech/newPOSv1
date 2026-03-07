import {moduleName} from "./moduleName";
import {uiWorkbenchSlice} from "./features/slices";
import {uiWorkbenchActors} from "./features/actors";
import {uiWorkbenchCommands} from "./features/commands";
import {uiWorkbenchModulePreSetup} from "./application/modulePreSetup";
import {uiWorkbenchErrorMessages} from "./supports/errors";
import {uiWorkbenchParameters} from "./supports/parameters";
import {uiWorkbenchEpics} from "./features/epics";
import {uiWorkbenchMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiWorkbenchScreenParts} from "./ui";

export const uiWorkbenchModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiWorkbenchSlice,
    middlewares: uiWorkbenchMiddlewares,
    epics: uiWorkbenchEpics,
    commands: uiWorkbenchCommands,
    actors: uiWorkbenchActors,
    errorMessages: uiWorkbenchErrorMessages,
    parameters: uiWorkbenchParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiWorkbenchModulePreSetup,
    screenParts:uiWorkbenchScreenParts,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiWorkbenchSlice} from "./features/slices";
export {uiWorkbenchCommands} from "./features/commands";
export {uiWorkbenchErrorMessages} from "./supports/errors";
export {uiWorkbenchParameters} from "./supports/parameters";
export {uiWorkbenchApis} from "./supports";