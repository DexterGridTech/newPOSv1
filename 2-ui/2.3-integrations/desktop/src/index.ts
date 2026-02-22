import {moduleName} from "./moduleName";
import {uiIntegrationDesktopSlice} from "./features/slices";
import {uiIntegrationDesktopActors} from "./features/actors";
import {uiIntegrationDesktopCommands} from "./features/commands";
import {uiIntegrationDesktopModulePreSetup} from "./application/modulePreSetup";
import {uiIntegrationDesktopErrorMessages} from "./supports/errors";
import {uiIntegrationDesktopParameters} from "./supports/parameters";
import {uiIntegrationDesktopEpics} from "./features/epics";
import {uiIntegrationDesktopMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiIntegrationDesktopScreenParts} from "./ui";
import {uiCoreBaseModule} from "@impos2/ui-core-base";
import {uiAdminModule} from "@impos2/ui-admin";

export const uiIntegrationDesktopModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: uiIntegrationDesktopSlice,
    middlewares: uiIntegrationDesktopMiddlewares,
    epics: uiIntegrationDesktopEpics,
    commands: uiIntegrationDesktopCommands,
    actors: uiIntegrationDesktopActors,
    errorMessages: uiIntegrationDesktopErrorMessages,
    parameters: uiIntegrationDesktopParameters,
    dependencies: [uiCoreBaseModule,uiAdminModule],
    modulePreSetup: uiIntegrationDesktopModulePreSetup,
    screenParts:uiIntegrationDesktopScreenParts,
    preSetupPriority: 0
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {uiIntegrationDesktopSlice} from "./features/slices";
export {uiIntegrationDesktopCommands} from "./features/commands";
export {uiIntegrationDesktopErrorMessages} from "./supports/errors";
export {uiIntegrationDesktopParameters} from "./supports/parameters";
export {uiIntegrationDesktopApis} from "./supports";