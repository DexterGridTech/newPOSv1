import {moduleName} from "./moduleName";
import {adapterAndroidSlice} from "./features/slices";
import {adapterAndroidActors} from "./features/actors";
import {adapterAndroidCommands} from "./features/commands";
import {adapterAndroidModulePreSetup} from "./application/modulePreSetup";
import {adapterAndroidErrorMessages} from "./supports/errors";
import {adapterAndroidParameters} from "./supports/parameters";
import {adapterAndroidEpics} from "./features/epics";
import {adapterAndroidMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiCoreBaseModule} from "@impos2/ui-core-base";
import {adapterAndroidScreenParts} from "./ui";

export const adapterAndroidModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: adapterAndroidSlice,
    middlewares: adapterAndroidMiddlewares,
    epics: adapterAndroidEpics,
    commands: adapterAndroidCommands,
    actors: adapterAndroidActors,
    errorMessages: adapterAndroidErrorMessages,
    parameters: adapterAndroidParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: adapterAndroidModulePreSetup,
    screenParts:adapterAndroidScreenParts,
    preSetupPriority: 3001//adapter 模块使用3001-3999
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {adapterAndroidSlice} from "./features/slices";
export {adapterAndroidCommands} from "./features/commands";
export {adapterAndroidErrorMessages} from "./supports/errors";
export {adapterAndroidParameters} from "./supports/parameters";
export {adapterAndroidApis} from "./supports";