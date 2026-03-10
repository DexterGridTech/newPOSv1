import {moduleName} from "./moduleName";
import {uiCoreAdminSlice} from "./features/slices";
import {uiCoreAdminActors} from "./features/actors";
import {uiCoreAdminCommands} from "./features/commands";
import {uiCoreAdminModulePreSetup} from "./application/modulePreSetup";
import {uiCoreAdminErrorMessages} from "./supports/errors";
import {uiCoreAdminParameters} from "./supports/parameters";
import {uiCoreAdminEpics} from "./features/epics";
import {uiCoreAdminMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiCoreAdminScreenParts} from "./ui";
import {uiCoreBaseModule} from "@impos2/ui-core-base";

export const uiCoreAdminModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiCoreAdminSlice,
    middlewares: uiCoreAdminMiddlewares,
    epics: uiCoreAdminEpics,
    commands: uiCoreAdminCommands,
    actors: uiCoreAdminActors,
    errorMessages: uiCoreAdminErrorMessages,
    parameters: uiCoreAdminParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: uiCoreAdminModulePreSetup,
    screenParts: uiCoreAdminScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./ui/modals/AdminPopup";
export {uiCoreAdminSlice} from "./features/slices";
export {uiCoreAdminCommands} from "./features/commands";
export {uiCoreAdminErrorMessages} from "./supports/errors";
export {uiCoreAdminParameters} from "./supports/parameters";
export {uiCoreAdminApis} from "./supports";