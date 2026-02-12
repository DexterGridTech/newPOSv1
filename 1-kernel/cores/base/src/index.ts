import {AppModule} from "./application/types";
import {moduleName} from "./moduleName";
import {kernelCoreBaseSlice} from "./features/slices";
import {kernelCoreBaseActors} from "./features/actors";
import {kernelCoreBaseCommands} from "./features/commands";
import {kernelCoreBaseModulePreInitiate} from "./application/modulePreInitiate";
import {kernelCoreBaseErrorMessages} from "./supports/errors";
import {kernelCoreBaseParameters} from "./supports/parameters";

export const kernelCoreBaseModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelCoreBaseSlice,
    middlewares: [],
    epics: {},
    commands: kernelCoreBaseCommands,
    actors: kernelCoreBaseActors,
    apis: {},
    errorMessages: kernelCoreBaseErrorMessages,
    parameters: kernelCoreBaseParameters,
    dependencies: [],
    modulePreInitiate: kernelCoreBaseModulePreInitiate,
    modulePreInitiatePriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./application/types";
export {kernelCoreBaseSlice} from "./features/slices";
export {kernelCoreBaseCommands} from "./features/commands";
export {kernelCoreBaseErrorMessages} from "./supports/errors";
export {kernelCoreBaseParameters} from "./supports/parameters";