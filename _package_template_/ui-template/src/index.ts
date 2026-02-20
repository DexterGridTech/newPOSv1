import {moduleName} from "./moduleName";
import {uiXXXSlice} from "./features/slices";
import {uiXXXActors} from "./features/actors";
import {uiXXXCommands} from "./features/commands";
import {uiXXXModulePreSetup} from "./application/modulePreSetup";
import {uiXXXErrorMessages} from "./supports/errors";
import {uiXXXParameters} from "./supports/parameters";
import {uiXXXEpics} from "./features/epics";
import {uiXXXMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";

export const uiXXXModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiXXXSlice,
    middlewares: uiXXXMiddlewares,
    epics: uiXXXEpics,
    commands: uiXXXCommands,
    actors: uiXXXActors,
    errorMessages: uiXXXErrorMessages,
    parameters: uiXXXParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiXXXModulePreSetup,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiXXXSlice} from "./features/slices";
export {uiXXXCommands} from "./features/commands";
export {uiXXXErrorMessages} from "./supports/errors";
export {uiXXXParameters} from "./supports/parameters";
export {uiXXXApis} from "./supports";