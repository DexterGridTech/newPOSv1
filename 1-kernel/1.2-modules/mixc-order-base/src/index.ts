import {moduleName} from "./moduleName";
import {kernelMixcOrderBaseSlice} from "./features/slices";
import {kernelMixcOrderBaseActors} from "./features/actors";
import {kernelMixcOrderBaseCommands} from "./features/commands";
import {kernelMixcOrderBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcOrderBaseErrorMessages} from "./supports/errors";
import {kernelMixcOrderBaseParameters} from "./supports/parameters";
import {kernelMixcOrderBaseEpics} from "./features/epics";
import {kernelMixcOrderBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelMixcOrderBaseModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcOrderBaseSlice,
    middlewares: kernelMixcOrderBaseMiddlewares,
    epics: kernelMixcOrderBaseEpics,
    commands: kernelMixcOrderBaseCommands,
    actors: kernelMixcOrderBaseActors,
    errorMessages: kernelMixcOrderBaseErrorMessages,
    parameters: kernelMixcOrderBaseParameters,
    dependencies: [],
    modulePreSetup: kernelMixcOrderBaseModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelMixcOrderBaseSlice} from "./features/slices";
export {kernelMixcOrderBaseCommands} from "./features/commands";
export {kernelMixcOrderBaseErrorMessages} from "./supports/errors";
export {kernelMixcOrderBaseParameters} from "./supports/parameters";
export {kernelMixcOrderBaseApis} from "./supports";