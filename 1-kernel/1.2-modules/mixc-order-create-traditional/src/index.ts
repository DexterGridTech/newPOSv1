import {moduleName} from "./moduleName";
import {kernelMixcOrderCreateTraditionalSlice} from "./features/slices";
import {kernelMixcOrderCreateTraditionalActors} from "./features/actors";
import {kernelMixcOrderCreateTraditionalCommands} from "./features/commands";
import {kernelMixcOrderCreateTraditionalModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcOrderCreateTraditionalErrorMessages} from "./supports/errors";
import {kernelMixcOrderCreateTraditionalParameters} from "./supports/parameters";
import {kernelMixcOrderCreateTraditionalEpics} from "./features/epics";
import {kernelMixcOrderCreateTraditionalMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelMixcOrderCreateTraditionalModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcOrderCreateTraditionalSlice,
    middlewares: kernelMixcOrderCreateTraditionalMiddlewares,
    epics: kernelMixcOrderCreateTraditionalEpics,
    commands: kernelMixcOrderCreateTraditionalCommands,
    actors: kernelMixcOrderCreateTraditionalActors,
    errorMessages: kernelMixcOrderCreateTraditionalErrorMessages,
    parameters: kernelMixcOrderCreateTraditionalParameters,
    dependencies: [],
    modulePreSetup: kernelMixcOrderCreateTraditionalModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./selectors";
export {kernelMixcOrderCreateTraditionalSlice} from "./features/slices";
export {kernelMixcOrderCreateTraditionalCommands} from "./features/commands";
export {kernelMixcOrderCreateTraditionalErrorMessages} from "./supports/errors";
export {kernelMixcOrderCreateTraditionalParameters} from "./supports/parameters";
export {kernelMixcOrderCreateTraditionalApis} from "./supports";