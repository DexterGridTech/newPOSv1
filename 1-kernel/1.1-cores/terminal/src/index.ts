import {moduleName} from "./moduleName";
import {kernelCoreTerminalSlice} from "./features/slices";
import {kernelCoreTerminalActors} from "./features/actors";
import {kernelCoreTerminalCommands} from "./features/commands";
import {kernelCoreTerminalPreSetup} from "./application/modulePreSetup";
import {kernelCoreTerminalErrorMessages} from "./supports/errors";
import {kernelCoreTerminalParameters} from "./supports/parameters";
import {kernelCoreTerminalEpics} from "./features/epics";
import {kernelCoreTerminalMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";

export const kernelCoreTerminalModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelCoreTerminalSlice,
    middlewares: kernelCoreTerminalMiddlewares,
    epics: kernelCoreTerminalEpics,
    commands: kernelCoreTerminalCommands,
    actors: kernelCoreTerminalActors,
    errorMessages: kernelCoreTerminalErrorMessages,
    parameters: kernelCoreTerminalParameters,
    dependencies: [kernelCoreBaseModule, kernelCoreInterconnectionModule, kernelCoreNavigationModule],
    modulePreSetup: kernelCoreTerminalPreSetup,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelCoreTerminalSlice} from "./features/slices";
export {kernelCoreTerminalCommands} from "./features/commands";
export {kernelCoreTerminalErrorMessages} from "./supports/errors";
export {kernelCoreTerminalParameters} from "./supports/parameters";
export {kernelCoreTerminalApis} from "./supports";