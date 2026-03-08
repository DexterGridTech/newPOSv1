import {moduleName} from "./moduleName";
import {kernelMixcOperatorSlice} from "./features/slices";
import {kernelMixcOperatorActors} from "./features/actors";
import {kernelMixcOperatorCommands} from "./features/commands";
import {kernelMixcOperatorModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcOperatorErrorMessages} from "./supports/errors";
import {kernelMixcOperatorParameters} from "./supports/parameters";
import {kernelMixcOperatorEpics} from "./features/epics";
import {kernelMixcOperatorMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelMixcOperatorModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcOperatorSlice,
    middlewares: kernelMixcOperatorMiddlewares,
    epics: kernelMixcOperatorEpics,
    commands: kernelMixcOperatorCommands,
    actors: kernelMixcOperatorActors,
    errorMessages: kernelMixcOperatorErrorMessages,
    parameters: kernelMixcOperatorParameters,
    dependencies: [],
    modulePreSetup: kernelMixcOperatorModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelMixcOperatorSlice} from "./features/slices";
export {kernelMixcOperatorCommands} from "./features/commands";
export {kernelMixcOperatorErrorMessages} from "./supports/errors";
export {kernelMixcOperatorParameters} from "./supports/parameters";
export {kernelMixcOperatorApis} from "./supports";