import {moduleName} from "./moduleName";
import {kernelProductBaseSlice} from "./features/slices";
import {kernelProductBaseActors} from "./features/actors";
import {kernelProductBaseCommands} from "./features/commands";
import {kernelProductBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelProductBaseErrorMessages} from "./supports/errors";
import {kernelProductBaseParameters} from "./supports/parameters";
import {kernelProductBaseEpics} from "./features/epics";
import {kernelProductBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {packageVersion} from './generated/packageVersion';

export const kernelProductBaseModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelProductBaseSlice,
    middlewares: kernelProductBaseMiddlewares,
    epics: kernelProductBaseEpics,
    commands: kernelProductBaseCommands,
    actors: kernelProductBaseActors,
    errorMessages: kernelProductBaseErrorMessages,
    parameters: kernelProductBaseParameters,
    dependencies: [],
    modulePreSetup: kernelProductBaseModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelProductBaseSlice} from "./features/slices";
export {kernelProductBaseCommands} from "./features/commands";
export {kernelProductBaseErrorMessages} from "./supports/errors";
export {kernelProductBaseParameters} from "./supports/parameters";
export {kernelProductBaseApis} from "./supports";