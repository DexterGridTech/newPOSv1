import {moduleName} from "./moduleName";
import {uiDeviceActivateSlice} from "./features/slices";
import {uiDeviceActivateActors} from "./features/actors";
import {uiDeviceActivateCommands} from "./features/commands";
import {uiDeviceActivateModulePreSetup} from "./application/modulePreSetup";
import {uiDeviceActivateErrorMessages} from "./supports/errors";
import {uiDeviceActivateParameters} from "./supports/parameters";
import {uiDeviceActivateEpics} from "./features/epics";
import {uiDeviceActivateMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiDeviceActivateScreenParts} from "./ui";
import {kernelTerminalModule} from "@impos2/kernel-terminal";
import {uiCoreBaseModule} from "@impos2/ui-core-base";

export const uiDeviceActivateModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiDeviceActivateSlice,
    middlewares: uiDeviceActivateMiddlewares,
    epics: uiDeviceActivateEpics,
    commands: uiDeviceActivateCommands,
    actors: uiDeviceActivateActors,
    errorMessages: uiDeviceActivateErrorMessages,
    parameters: uiDeviceActivateParameters,
    dependencies: [kernelTerminalModule, uiCoreBaseModule],
    modulePreSetup: uiDeviceActivateModulePreSetup,
    screenParts: uiDeviceActivateScreenParts,
    preSetupPriority: 2202//ui module 模块使用2201-2299
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiDeviceActivateSlice} from "./features/slices";
export {uiDeviceActivateCommands} from "./features/commands";
export {uiDeviceActivateErrorMessages} from "./supports/errors";
export {uiDeviceActivateParameters} from "./supports/parameters";
export {uiDeviceActivateApis} from "./supports";