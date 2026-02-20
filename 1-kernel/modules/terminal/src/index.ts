import {moduleName} from "./moduleName";
import {kernelTerminalSlice} from "./features/slices";
import {kernelTerminalActors} from "./features/actors";
import {kernelTerminalCommands} from "./features/commands";
import {kernelTerminalModulePreSetup} from "./application/modulePreSetup";
import {kernelTerminalErrorMessages} from "./supports/errors";
import {kernelTerminalParameters} from "./supports/parameters";
import {kernelTerminalEpics} from "./features/epics";
import {kernelTerminalMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base-v1";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection-v1";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation-v1";

export const kernelTerminalModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelTerminalSlice,
    middlewares: kernelTerminalMiddlewares,
    epics: kernelTerminalEpics,
    commands: kernelTerminalCommands,
    actors: kernelTerminalActors,
    errorMessages: kernelTerminalErrorMessages,
    parameters: kernelTerminalParameters,
    dependencies: [kernelCoreBaseModule, kernelCoreInterconnectionModule, kernelCoreNavigationModule],
    modulePreSetup: kernelTerminalModulePreSetup,
    preSetupPriority: 101//kernel module 模块使用101-200
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelTerminalSlice} from "./features/slices";
export {kernelTerminalCommands} from "./features/commands";
export {kernelTerminalErrorMessages} from "./supports/errors";
export {kernelTerminalParameters} from "./supports/parameters";
export {kernelTerminalApis} from "./supports";