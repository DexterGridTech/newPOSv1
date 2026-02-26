import {moduleName} from "./moduleName";
import {kernelCoreTaskSlice} from "./features/slices";
import {kernelCoreTaskActors} from "./features/actors";
import {kernelCoreTaskCommands} from "./features/commands";
import {kernelCoreTaskModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreTaskErrorMessages} from "./supports/errors";
import {kernelCoreTaskParameters} from "./supports/parameters";
import {kernelCoreTaskEpics} from "./features/epics";
import {kernelCoreTaskMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernelCoreTaskModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelCoreTaskSlice,
    middlewares: kernelCoreTaskMiddlewares,
    epics: kernelCoreTaskEpics,
    commands: kernelCoreTaskCommands,
    actors: kernelCoreTaskActors,
    errorMessages: kernelCoreTaskErrorMessages,
    parameters: kernelCoreTaskParameters,
    dependencies: [],
    modulePreSetup: kernelCoreTaskModulePreSetup,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelCoreTaskSlice} from "./features/slices";
export {kernelCoreTaskCommands} from "./features/commands";
export {kernelCoreTaskErrorMessages} from "./supports/errors";
export {kernelCoreTaskParameters} from "./supports/parameters";
export {kernelCoreTaskApis} from "./supports";