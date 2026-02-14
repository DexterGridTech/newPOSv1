import {AppModule} from "./application/types";
import {moduleName} from "./moduleName";
import {kernelCoreBaseSlice} from "./features/slices";
import {kernelCoreBaseActors} from "./features/actors";
import {kernelCoreBaseCommands} from "./features/commands";
import {kernelCoreBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreBaseErrorMessages} from "./supports/errors";
import {kernelCoreBaseParameters} from "./supports/parameters";
import {kernelCoreBaseEpics} from "./features/epics";
import {kernelCoreBaseMiddlewares} from "./features/middlewares";

export const kernelCoreBaseModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelCoreBaseSlice,
    middlewares: kernelCoreBaseMiddlewares,
    epics: kernelCoreBaseEpics,
    commands: kernelCoreBaseCommands,
    actors: kernelCoreBaseActors,
    errorMessages: kernelCoreBaseErrorMessages,
    parameters: kernelCoreBaseParameters,
    dependencies: [],
    modulePreSetup: kernelCoreBaseModulePreSetup,
    preSetupPriority: 100//无加载优先级需求
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./application/types";
export * from "./application/applicationManager";
export {kernelCoreBaseSlice} from "./features/slices";
export {kernelCoreBaseCommands} from "./features/commands";
export {kernelCoreBaseErrorMessages} from "./supports/errors";
export {kernelCoreBaseParameters} from "./supports/parameters";
export {kernelCoreBaseApis} from "./supports";