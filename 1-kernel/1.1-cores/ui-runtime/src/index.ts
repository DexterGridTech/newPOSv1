import {moduleName} from "./moduleName";
import {kernelCoreUiRuntimeSlice} from "./features/slices";
import {kernelCoreUiRuntimeActors} from "./features/actors";
import {kernelCoreUiRuntimeCommands} from "./features/commands";
import {kernelCoreUiRuntimeModulePreSetup} from "./application/modulePreSetup";
import {kernelCoreUiRuntimeErrorMessages} from "./supports/errors";
import {kernelCoreUiRuntimeParameters} from "./supports/parameters";
import {kernelCoreUiRuntimeEpics} from "./features/epics";
import {kernelCoreUiRuntimeMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {packageVersion} from './generated/packageVersion';

export const kernelCoreUiRuntimeModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelCoreUiRuntimeSlice,
    middlewares: kernelCoreUiRuntimeMiddlewares,
    epics: kernelCoreUiRuntimeEpics,
    commands: kernelCoreUiRuntimeCommands,
    actors: kernelCoreUiRuntimeActors,
    errorMessages: kernelCoreUiRuntimeErrorMessages,
    parameters: kernelCoreUiRuntimeParameters,
    dependencies: [kernelCoreBaseModule, kernelCoreInterconnectionModule],
    modulePreSetup: kernelCoreUiRuntimeModulePreSetup,
}

export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelCoreUiRuntimeSlice} from "./features/slices";
export {kernelCoreUiRuntimeCommands} from "./features/commands";
export {kernelCoreUiRuntimeErrorMessages} from "./supports/errors";
export {kernelCoreUiRuntimeParameters} from "./supports/parameters";
export {kernelCoreUiRuntimeApis} from "./supports";
