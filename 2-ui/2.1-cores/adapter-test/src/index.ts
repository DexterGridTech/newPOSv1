import {moduleName} from "./moduleName";
import {uiCoreAdapterTestSlice} from "./features/slices";
import {uiCoreAdapterTestActors} from "./features/actors";
import {uiCoreAdapterTestCommands} from "./features/commands";
import {uiCoreAdapterTestModulePreSetup} from "./application/modulePreSetup";
import {uiCoreAdapterTestErrorMessages} from "./supports/errors";
import {uiCoreAdapterTestParameters} from "./supports/parameters";
import {uiCoreAdapterTestEpics} from "./features/epics";
import {uiCoreAdapterTestMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiCoreAdapterTestScreenParts} from "./ui";
import {uiCoreBaseModule} from "@impos2/ui-core-base";
import {packageVersion} from './generated/packageVersion';

export const uiCoreAdapterTestModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: uiCoreAdapterTestSlice,
    middlewares: uiCoreAdapterTestMiddlewares,
    epics: uiCoreAdapterTestEpics,
    commands: uiCoreAdapterTestCommands,
    actors: uiCoreAdapterTestActors,
    errorMessages: uiCoreAdapterTestErrorMessages,
    parameters: uiCoreAdapterTestParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: uiCoreAdapterTestModulePreSetup,
    screenParts: uiCoreAdapterTestScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./ui";
export {uiCoreAdapterTestSlice} from "./features/slices";
export {uiCoreAdapterTestCommands} from "./features/commands";
export {uiCoreAdapterTestErrorMessages} from "./supports/errors";
export {uiCoreAdapterTestParameters} from "./supports/parameters";
export {uiCoreAdapterTestApis} from "./supports";