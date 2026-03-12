import {moduleName} from "./moduleName";
import {kernelMixcProductSlice} from "./features/slices";
import {kernelMixcProductActors} from "./features/actors";
import {kernelMixcProductCommands} from "./features/commands";
import {kernelMixcProductModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcProductErrorMessages} from "./supports/errors";
import {kernelMixcProductParameters} from "./supports/parameters";
import {kernelMixcProductEpics} from "./features/epics";
import {kernelMixcProductMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelMixcProductModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcProductSlice,
    middlewares: kernelMixcProductMiddlewares,
    epics: kernelMixcProductEpics,
    commands: kernelMixcProductCommands,
    actors: kernelMixcProductActors,
    errorMessages: kernelMixcProductErrorMessages,
    parameters: kernelMixcProductParameters,
    dependencies: [],
    modulePreSetup: kernelMixcProductModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelMixcProductSlice} from "./features/slices";
export {kernelMixcProductCommands} from "./features/commands";
export {kernelMixcProductErrorMessages} from "./supports/errors";
export {kernelMixcProductParameters} from "./supports/parameters";
export {kernelMixcProductApis} from "./supports";