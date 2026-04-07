import {moduleName} from "./moduleName";
import {kernelPayBaseSlice} from "./features/slices";
import {kernelPayBaseActors} from "./features/actors";
import {kernelPayBaseCommands} from "./features/commands";
import {kernelPayBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelPayBaseErrorMessages} from "./supports/errors";
import {kernelPayBaseParameters} from "./supports/parameters";
import {kernelPayBaseEpics} from "./features/epics";
import {kernelPayBaseMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelOrderBaseModule} from "@impos2/kernel-order-base";
import {packageVersion} from './generated/packageVersion';

export const kernelPayBaseModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelPayBaseSlice,
    middlewares: kernelPayBaseMiddlewares,
    epics: kernelPayBaseEpics,
    commands: kernelPayBaseCommands,
    actors: kernelPayBaseActors,
    errorMessages: kernelPayBaseErrorMessages,
    parameters: kernelPayBaseParameters,
    dependencies: [
        kernelOrderBaseModule
    ],
    modulePreSetup: kernelPayBaseModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelPayBaseSlice} from "./features/slices";
export {kernelPayBaseCommands} from "./features/commands";
export {kernelPayBaseErrorMessages} from "./supports/errors";
export {kernelPayBaseParameters} from "./supports/parameters";
export {kernelPayBaseApis} from "./supports";