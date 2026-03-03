import {moduleName} from "./moduleName";
import {uiAdminSlice} from "./features/slices";
import {uiAdminActors} from "./features/actors";
import {uiAdminCommands} from "./features/commands";
import {uiAdminModulePreSetup} from "./application/modulePreSetup";
import {uiAdminErrorMessages} from "./supports/errors";
import {uiAdminParameters} from "./supports/parameters";
import {uiAdminEpics} from "./features/epics";
import {uiAdminMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiAdminScreenParts} from "./ui";
import {uiCoreBaseModule} from "@impos2/ui-core-base";

export const uiAdminModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiAdminSlice,
    middlewares: uiAdminMiddlewares,
    epics: uiAdminEpics,
    commands: uiAdminCommands,
    actors: uiAdminActors,
    errorMessages: uiAdminErrorMessages,
    parameters: uiAdminParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: uiAdminModulePreSetup,
    screenParts: uiAdminScreenParts,
    preSetupPriority: 2201//ui module 模块使用2201-2299
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiAdminSlice} from "./features/slices";
export {uiAdminCommands} from "./features/commands";
export {uiAdminErrorMessages} from "./supports/errors";
export {uiAdminParameters} from "./supports/parameters";
export {uiAdminApis} from "./supports";