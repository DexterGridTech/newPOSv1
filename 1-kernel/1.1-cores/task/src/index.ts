import {moduleName} from "./moduleName";
import {kernelCoreTaskSlice} from "./features/slices";
import {kernelCoreTaskActors} from "./features/actors";
import {kernelCoreTaskCommands} from "./features/commands";
import {kernelCoreTaskModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreTaskErrorMessages} from "./supports/errors";
import {kernelCoreTaskParameters} from "./supports/parameters";
import {kernelCoreTaskEpics} from "./features/epics";
import {kernelCoreTaskMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {packageVersion} from './generated/packageVersion';

export const kernelCoreTaskModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelCoreTaskSlice,
    middlewares: kernelCoreTaskMiddlewares,
    epics: kernelCoreTaskEpics,
    commands: kernelCoreTaskCommands,
    actors: kernelCoreTaskActors,
    errorMessages: kernelCoreTaskErrorMessages,
    parameters: kernelCoreTaskParameters,
    dependencies: [kernelCoreBaseModule, kernelCoreInterconnectionModule],
    modulePreSetup: kernelCoreTaskModulePreSetup,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelCoreTaskSlice} from "./features/slices";
export {kernelCoreTaskCommands} from "./features/commands";
export {kernelCoreTaskErrorMessages} from "./supports/errors";
export {kernelCoreTaskParameters} from "./supports/parameters";
export {kernelCoreTaskApis} from "./supports";