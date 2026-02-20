import {moduleName} from "./moduleName";
import {kernelCoreInterconnectionSlice} from "./features/slices";
import {kernelCoreInterconnectionActors} from "./features/actors";
import {kernelCoreInterconnectionCommands} from "./features/commands";
import {kernelCoreInterconnectionModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreInterconnectionErrorMessages} from "./supports/errors";
import {kernelCoreInterconnectionParameters} from "./supports/parameters";
import {kernelCoreInterconnectionEpics} from "./features/epics";
import {kernelCoreInterconnectionMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base-v1";

export const kernelCoreInterconnectionModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelCoreInterconnectionSlice,
    middlewares: kernelCoreInterconnectionMiddlewares,
    epics: kernelCoreInterconnectionEpics,
    commands: kernelCoreInterconnectionCommands,
    actors: kernelCoreInterconnectionActors,
    errorMessages: kernelCoreInterconnectionErrorMessages,
    parameters: kernelCoreInterconnectionParameters,
    dependencies: [kernelCoreBaseModule],
    modulePreSetup: kernelCoreInterconnectionModulePreSetup,
    preSetupPriority: 2//kernel core 模块使用1-100
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelCoreInterconnectionSlice} from "./features/slices";
export {kernelCoreInterconnectionCommands} from "./features/commands";
export {kernelCoreInterconnectionErrorMessages} from "./supports/errors";
export {kernelCoreInterconnectionParameters} from "./supports/parameters";
export {kernelCoreInterconnectionApis} from "./supports";