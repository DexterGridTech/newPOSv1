import {moduleName} from "./moduleName";
import {kernelOrderBaseSlice} from "./features/slices";
import {kernelOrderBaseActors} from "./features/actors";
import {kernelOrderBaseCommands} from "./features/commands";
import {kernelOrderBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelOrderBaseErrorMessages} from "./supports/errors";
import {kernelOrderBaseParameters} from "./supports/parameters";
import {kernelOrderBaseEpics} from "./features/epics";
import {kernelOrderBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {packageVersion} from './generated/packageVersion';

export const kernelOrderBaseModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelOrderBaseSlice,
    middlewares: kernelOrderBaseMiddlewares,
    epics: kernelOrderBaseEpics,
    commands: kernelOrderBaseCommands,
    actors: kernelOrderBaseActors,
    errorMessages: kernelOrderBaseErrorMessages,
    parameters: kernelOrderBaseParameters,
    dependencies: [],
    modulePreSetup: kernelOrderBaseModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelOrderBaseSlice} from "./features/slices";
export {kernelOrderBaseCommands} from "./features/commands";
export {kernelOrderBaseErrorMessages} from "./supports/errors";
export {kernelOrderBaseParameters} from "./supports/parameters";
export {kernelOrderBaseApis} from "./supports";