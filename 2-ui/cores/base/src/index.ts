import {moduleName} from "./moduleName";
import {uiCoreBaseSlice} from "./features/slices";
import {uiCoreBaseActors} from "./features/actors";
import {uiCoreBaseCommands} from "./features/commands";
import {uiCoreBaseModulePreSetup} from "./application/modulePreSetup";
import {uiCoreBaseErrorMessages} from "./supports/errors";
import {uiCoreBaseParameters} from "./supports/parameters";
import {uiCoreBaseEpics} from "./features/epics";
import {uiCoreBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const uiCoreBaseModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiCoreBaseSlice,
    middlewares: uiCoreBaseMiddlewares,
    epics: uiCoreBaseEpics,
    commands: uiCoreBaseCommands,
    actors: uiCoreBaseActors,
    errorMessages: uiCoreBaseErrorMessages,
    parameters: uiCoreBaseParameters,
    dependencies: [],
    modulePreSetup: uiCoreBaseModulePreSetup,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiCoreBaseSlice} from "./features/slices";
export {uiCoreBaseCommands} from "./features/commands";
export {uiCoreBaseErrorMessages} from "./supports/errors";
export {uiCoreBaseParameters} from "./supports/parameters";
export {uiCoreBaseApis} from "./supports";