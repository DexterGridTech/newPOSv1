import {moduleName} from "./moduleName";
import {assemblyAndroidDesktopSlice} from "./features/slices";
import {assemblyAndroidDesktopActors} from "./features/actors";
import {assemblyAndroidDesktopCommands} from "./features/commands";
import {assemblyAndroidDesktopModulePreSetup} from "./application/modulePreSetup";
import {assemblyAndroidDesktopErrorMessages} from "./supports/errors";
import {assemblyAndroidDesktopParameters} from "./supports/parameters";
import {assemblyAndroidDesktopEpics} from "./features/epics";
import {assemblyAndroidDesktopMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {adapterAndroidModule} from "@impos2/adapter-android";
import {assemblyAndroidDesktopScreenParts} from "./ui";
import {uiIntegrationDesktopModule} from "@impos2/ui-integration-desktop";

export const assemblyAndroidDesktopModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: assemblyAndroidDesktopSlice,
    middlewares: assemblyAndroidDesktopMiddlewares,
    epics: assemblyAndroidDesktopEpics,
    commands: assemblyAndroidDesktopCommands,
    actors: assemblyAndroidDesktopActors,
    errorMessages: assemblyAndroidDesktopErrorMessages,
    parameters: assemblyAndroidDesktopParameters,
    dependencies: [adapterAndroidModule,uiIntegrationDesktopModule],
    modulePreSetup: assemblyAndroidDesktopModulePreSetup,
    screenParts: assemblyAndroidDesktopScreenParts,
    preSetupPriority: 4001//assembly 模块使用4001-4999
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {assemblyAndroidDesktopSlice} from "./features/slices";
export {assemblyAndroidDesktopCommands} from "./features/commands";
export {assemblyAndroidDesktopErrorMessages} from "./supports/errors";
export {assemblyAndroidDesktopParameters} from "./supports/parameters";
export {assemblyAndroidDesktopApis} from "./supports";