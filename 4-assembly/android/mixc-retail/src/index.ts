import {moduleName} from "./moduleName";
import {assemblyAndroidMixcRetailSlice} from "./features/slices";
import {assemblyAndroidMixcRetailActors} from "./features/actors";
import {assemblyAndroidMixcRetailCommands} from "./features/commands";
import {assemblyAndroidMixcRetailModulePreSetup} from "./application/modulePreSetup";
import {assemblyAndroidMixcRetailErrorMessages} from "./supports/errors";
import {assemblyAndroidMixcRetailParameters} from "./supports/parameters";
import {assemblyAndroidMixcRetailEpics} from "./features/epics";
import {assemblyAndroidMixcRetailMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {adapterAndroidModule} from "@impos2/adapter-android";
import {assemblyAndroidMixcRetailScreenParts} from "./ui";
import {uiIntegrationMixcRetailModule} from "@impos2/ui-integration-mixc-retail";

export const assemblyAndroidMixcRetailModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: assemblyAndroidMixcRetailSlice,
    middlewares: assemblyAndroidMixcRetailMiddlewares,
    epics: assemblyAndroidMixcRetailEpics,
    commands: assemblyAndroidMixcRetailCommands,
    actors: assemblyAndroidMixcRetailActors,
    errorMessages: assemblyAndroidMixcRetailErrorMessages,
    parameters: assemblyAndroidMixcRetailParameters,
    dependencies: [adapterAndroidModule,uiIntegrationMixcRetailModule],
    modulePreSetup: assemblyAndroidMixcRetailModulePreSetup,
    screenParts: assemblyAndroidMixcRetailScreenParts,
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {assemblyAndroidMixcRetailSlice} from "./features/slices";
export {assemblyAndroidMixcRetailCommands} from "./features/commands";
export {assemblyAndroidMixcRetailErrorMessages} from "./supports/errors";
export {assemblyAndroidMixcRetailParameters} from "./supports/parameters";
export {assemblyAndroidMixcRetailApis} from "./supports";