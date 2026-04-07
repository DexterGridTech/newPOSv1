import {moduleName} from "./moduleName";
import {kernelProductFromContractSlice} from "./features/slices";
import {kernelProductFromContractActors} from "./features/actors";
import {kernelProductFromContractCommands} from "./features/commands";
import {kernelProductFromContractModulePreSetup} from "./application/modulePreSetup";
import {kernelProductFromContractErrorMessages} from "./supports/errors";
import {kernelProductFromContractParameters} from "./supports/parameters";
import {kernelProductFromContractEpics} from "./features/epics";
import {kernelProductFromContractMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelProductBaseModule} from "@impos2/kernel-product-base";
import {packageVersion} from './generated/packageVersion';

export const kernelProductFromContractModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelProductFromContractSlice,
    middlewares: kernelProductFromContractMiddlewares,
    epics: kernelProductFromContractEpics,
    commands: kernelProductFromContractCommands,
    actors: kernelProductFromContractActors,
    errorMessages: kernelProductFromContractErrorMessages,
    parameters: kernelProductFromContractParameters,
    dependencies: [kernelProductBaseModule],
    modulePreSetup: kernelProductFromContractModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelProductFromContractSlice} from "./features/slices";
export {kernelProductFromContractCommands} from "./features/commands";
export {kernelProductFromContractErrorMessages} from "./supports/errors";
export {kernelProductFromContractParameters} from "./supports/parameters";
export {kernelProductFromContractApis} from "./supports";