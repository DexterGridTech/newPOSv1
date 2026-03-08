import {moduleName} from "./moduleName";
import {uiMixcOperatorSlice} from "./features/slices";
import {uiMixcOperatorActors} from "./features/actors";
import {uiMixcOperatorCommands} from "./features/commands";
import {uiMixcOperatorModulePreSetup} from "./application/modulePreSetup";
import {uiMixcOperatorErrorMessages} from "./supports/errors";
import {uiMixcOperatorParameters} from "./supports/parameters";
import {uiMixcOperatorEpics} from "./features/epics";
import {uiMixcOperatorMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcOperatorScreenParts} from "./ui";

export const uiMixcOperatorModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiMixcOperatorSlice,
    middlewares: uiMixcOperatorMiddlewares,
    epics: uiMixcOperatorEpics,
    commands: uiMixcOperatorCommands,
    actors: uiMixcOperatorActors,
    errorMessages: uiMixcOperatorErrorMessages,
    parameters: uiMixcOperatorParameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: uiMixcOperatorModulePreSetup,
    screenParts:uiMixcOperatorScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiMixcOperatorSlice} from "./features/slices";
export {uiMixcOperatorCommands} from "./features/commands";
export {uiMixcOperatorErrorMessages} from "./supports/errors";
export {uiMixcOperatorParameters} from "./supports/parameters";
export {uiMixcOperatorApis} from "./supports";