import {moduleName} from "./moduleName";
import {kernelXXXSlice} from "./features/slices";
import {kernelXXXActors} from "./features/actors";
import {kernelXXXCommands} from "./features/commands";
import {kernelXXXModulePreSetup} from "./application/modulePreSetup";
import {kernelXXXErrorMessages} from "./supports/errors";
import {kernelXXXParameters} from "./supports/parameters";
import {kernelXXXEpics} from "./features/epics";
import {kernelXXXMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelXXXModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelXXXSlice,
    middlewares: kernelXXXMiddlewares,
    epics: kernelXXXEpics,
    commands: kernelXXXCommands,
    actors: kernelXXXActors,
    errorMessages: kernelXXXErrorMessages,
    parameters: kernelXXXParameters,
    dependencies: [],
    modulePreSetup: kernelXXXModulePreSetup,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./selectors";
export {kernelXXXSlice} from "./features/slices";
export {kernelXXXCommands} from "./features/commands";
export {kernelXXXErrorMessages} from "./supports/errors";
export {kernelXXXParameters} from "./supports/parameters";
export {kernelXXXApis} from "./supports";