import {moduleName} from "./moduleName";
import {assemblyAndroidMixcRetailSlice} from "./features/slices";
import {assemblyAndroidMixcRetailActors} from "./features/actors";
import {assemblyAndroidMixcRetailCommands} from "./features/commands";
import {assemblyAndroidMixcRetailErrorMessages} from "./supports/errors";
import {assemblyAndroidMixcRetailParameters} from "./supports/parameters";
import {assemblyAndroidMixcRetailEpics} from "./features/epics";
import {assemblyAndroidMixcRetailMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {assemblyAndroidMixcRetailScreenParts} from "./ui";
import {uiIntegrationMixcRetailModule} from "@impos2/ui-integration-mixc-retail";
import {releaseInfo} from "./generated/releaseInfo";

export const assemblyAndroidMixcRetailModule: AppModule = {
    name: moduleName,
    version: releaseInfo.assemblyVersion,
    slices: assemblyAndroidMixcRetailSlice,
    middlewares: assemblyAndroidMixcRetailMiddlewares,
    epics: assemblyAndroidMixcRetailEpics,
    commands: assemblyAndroidMixcRetailCommands,
    actors: assemblyAndroidMixcRetailActors,
    errorMessages: assemblyAndroidMixcRetailErrorMessages,
    parameters: assemblyAndroidMixcRetailParameters,
    dependencies: [uiIntegrationMixcRetailModule],
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