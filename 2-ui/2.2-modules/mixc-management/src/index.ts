import {moduleName} from "./moduleName";
import {uiMixcManagementSlice} from "./features/slices";
import {uiMixcManagementActors} from "./features/actors";
import {uiMixcManagementCommands} from "./features/commands";
import {uiMixcManagementModulePreSetup} from "./application/modulePreSetup";
import {uiMixcManagementErrorMessages} from "./supports/errors";
import {uiMixcManagementParameters} from "./supports/parameters";
import {uiMixcManagementEpics} from "./features/epics";
import {uiMixcManagementMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {uiMixcManagementScreenParts} from "./ui";
import {uiMixcWorkbenchModule} from "@impos2/ui-mixc-workbench";
import {packageVersion} from './generated/packageVersion';

export const uiMixcManagementModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: uiMixcManagementSlice,
    middlewares: uiMixcManagementMiddlewares,
    epics: uiMixcManagementEpics,
    commands: uiMixcManagementCommands,
    actors: uiMixcManagementActors,
    errorMessages: uiMixcManagementErrorMessages,
    parameters: uiMixcManagementParameters,
    dependencies: [
        kernelCoreNavigationModule,
        uiMixcWorkbenchModule
    ],
    modulePreSetup: uiMixcManagementModulePreSetup,
    screenParts:uiMixcManagementScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./ui/moduleScreenParts";
export {uiMixcManagementSlice} from "./features/slices";
export {uiMixcManagementCommands} from "./features/commands";
export {uiMixcManagementErrorMessages} from "./supports/errors";
export {uiMixcManagementParameters} from "./supports/parameters";
export {uiMixcManagementApis} from "./supports";