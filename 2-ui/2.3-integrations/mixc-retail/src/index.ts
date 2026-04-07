import {moduleName} from "./moduleName";
import {uiIntegrationMixcRetailSlice} from "./features/slices";
import {uiIntegrationMixcRetailActors} from "./features/actors";
import {uiIntegrationMixcRetailCommands} from "./features/commands";
import {uiIntegrationMixcRetailModulePreSetup} from "./application/modulePreSetup";
import {uiIntegrationMixcRetailErrorMessages} from "./supports/errors";
import {uiIntegrationMixcRetailParameters} from "./supports/parameters";
import {uiIntegrationMixcRetailEpics} from "./features/epics";
import {uiIntegrationMixcRetailMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiIntegrationMixcRetailScreenParts} from "./ui";
import {uiCoreBaseModule} from "@impos2/ui-core-base";
import {uiCoreAdminModule} from "@impos2/ui-core-admin";
import {uiMixcWorkbenchModule} from "@impos2/ui-mixc-workbench";
import {uiMixcUserModule} from "@impos2/ui-mixc-user";
import {uiCoreTerminalModule} from "@impos2/ui-core-terminal";
import {uiMixcTradeModule} from "@impos2/ui-mixc-trade";
import {uiMixcActivityModule} from "@impos2/ui-mixc-activity";
import {uiMixcManagementModule} from "@impos2/ui-mixc-management";
import {packageVersion} from './generated/packageVersion';

export const uiIntegrationMixcRetailModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: uiIntegrationMixcRetailSlice,
    middlewares: uiIntegrationMixcRetailMiddlewares,
    epics: uiIntegrationMixcRetailEpics,
    commands: uiIntegrationMixcRetailCommands,
    actors: uiIntegrationMixcRetailActors,
    errorMessages: uiIntegrationMixcRetailErrorMessages,
    parameters: uiIntegrationMixcRetailParameters,
    dependencies: [
        uiCoreBaseModule,
        uiCoreAdminModule,
        uiCoreTerminalModule,
        uiMixcWorkbenchModule,
        uiMixcUserModule,
        uiMixcTradeModule,
        uiMixcActivityModule,
        uiMixcManagementModule,
    ],
    modulePreSetup: uiIntegrationMixcRetailModulePreSetup,
    screenParts: uiIntegrationMixcRetailScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./ui";
export {uiIntegrationMixcRetailSlice} from "./features/slices";
export {uiIntegrationMixcRetailCommands} from "./features/commands";
export {uiIntegrationMixcRetailErrorMessages} from "./supports/errors";
export {uiIntegrationMixcRetailParameters} from "./supports/parameters";
export {uiIntegrationMixcRetailApis} from "./supports";