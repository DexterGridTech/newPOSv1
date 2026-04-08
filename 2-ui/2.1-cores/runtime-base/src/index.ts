import {moduleName} from "./moduleName";
import {uiCoreRuntimeBaseSlice} from "./features/slices";
import {uiCoreRuntimeBaseActors} from "./features/actors";
import {uiCoreRuntimeBaseCommands} from "./features/commands";
import {uiCoreRuntimeBaseModulePreSetup} from "./application/modulePreSetup";
import {uiCoreRuntimeBaseErrorMessages} from "./supports/errors";
import {uiCoreRuntimeBaseParameters} from "./supports/parameters";
import {uiCoreRuntimeBaseEpics} from "./features/epics";
import {uiCoreRuntimeBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreUiRuntimeModule} from "@impos2/kernel-core-ui-runtime";
import {uiCoreRuntimeBaseScreenParts} from "./ui";
import {kernelCoreTaskModule} from "@impos2/kernel-core-task";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {packageVersion} from './generated/packageVersion';

export const uiCoreRuntimeBaseModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: uiCoreRuntimeBaseSlice,
    middlewares: uiCoreRuntimeBaseMiddlewares,
    epics: uiCoreRuntimeBaseEpics,
    commands: uiCoreRuntimeBaseCommands,
    actors: uiCoreRuntimeBaseActors,
    errorMessages: uiCoreRuntimeBaseErrorMessages,
    parameters: uiCoreRuntimeBaseParameters,
    dependencies: [kernelCoreInterconnectionModule, kernelCoreUiRuntimeModule, kernelCoreTaskModule],
    modulePreSetup: uiCoreRuntimeBaseModulePreSetup,
    screenParts: uiCoreRuntimeBaseScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./contexts";
export * from "./ui";
export {uiCoreRuntimeBaseSlice} from "./features/slices";
export {uiCoreRuntimeBaseCommands} from "./features/commands";
export {uiCoreRuntimeBaseErrorMessages} from "./supports/errors";
export {uiCoreRuntimeBaseParameters} from "./supports/parameters";
export {uiCoreRuntimeBaseApis} from "./supports";
