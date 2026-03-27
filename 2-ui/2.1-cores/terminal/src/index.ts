import {moduleName} from "./moduleName";
import {uiCoreTerminalSlice} from "./features/slices";
import {uiCoreTerminalActors} from "./features/actors";
import {uiCoreTerminalCommands} from "./features/commands";
import {uiCoreTerminalModulePreSetup} from "./application/modulePreSetup";
import {uiCoreTerminalErrorMessages} from "./supports/errors";
import {uiCoreTerminalParameters} from "./supports/parameters";
import {uiCoreTerminalEpics} from "./features/epics";
import {uiCoreTerminalMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiCoreTerminalScreenParts} from "./ui";
import {kernelCoreTerminalModule} from "@impos2/kernel-core-terminal";
import {uiCoreBaseModule} from "@impos2/ui-core-base";

export const uiCoreTerminalModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiCoreTerminalSlice,
    middlewares: uiCoreTerminalMiddlewares,
    epics: uiCoreTerminalEpics,
    commands: uiCoreTerminalCommands,
    actors: uiCoreTerminalActors,
    errorMessages: uiCoreTerminalErrorMessages,
    parameters: uiCoreTerminalParameters,
    dependencies: [kernelCoreTerminalModule, uiCoreBaseModule],
    modulePreSetup: uiCoreTerminalModulePreSetup,
    screenParts: uiCoreTerminalScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiCoreTerminalSlice} from "./features/slices";
export {uiCoreTerminalCommands} from "./features/commands";
export {uiCoreTerminalErrorMessages} from "./supports/errors";
export {uiCoreTerminalParameters} from "./supports/parameters";
export {uiCoreTerminalApis} from "./supports";