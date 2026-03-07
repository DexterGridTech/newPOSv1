import {moduleName} from "./moduleName";
import {uiOperatorSlice} from "./features/slices";
import {uiOperatorActors} from "./features/actors";
import {uiOperatorCommands} from "./features/commands";
import {uiOperatorModulePreSetup} from "./application/modulePreSetup";
import {uiOperatorErrorMessages} from "./supports/errors";
import {uiOperatorParameters} from "./supports/parameters";
import {uiOperatorEpics} from "./features/epics";
import {uiOperatorMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiOperatorScreenParts} from "./ui";

export const uiOperatorModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiOperatorSlice,
    middlewares: uiOperatorMiddlewares,
    epics: uiOperatorEpics,
    commands: uiOperatorCommands,
    actors: uiOperatorActors,
    errorMessages: uiOperatorErrorMessages,
    parameters: uiOperatorParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiOperatorModulePreSetup,
    screenParts:uiOperatorScreenParts,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiOperatorSlice} from "./features/slices";
export {uiOperatorCommands} from "./features/commands";
export {uiOperatorErrorMessages} from "./supports/errors";
export {uiOperatorParameters} from "./supports/parameters";
export {uiOperatorApis} from "./supports";