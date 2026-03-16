import {moduleName} from "./moduleName";
import {kernelMixcOrderPaySlice} from "./features/slices";
import {kernelMixcOrderPayActors} from "./features/actors";
import {kernelMixcOrderPayCommands} from "./features/commands";
import {kernelMixcOrderPayModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcOrderPayErrorMessages} from "./supports/errors";
import {kernelMixcOrderPayParameters} from "./supports/parameters";
import {kernelMixcOrderPayEpics} from "./features/epics";
import {kernelMixcOrderPayMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelMixcOrderBaseModule} from "@impos2/kernel-mixc-order-base";

export const kernelMixcOrderPayModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcOrderPaySlice,
    middlewares: kernelMixcOrderPayMiddlewares,
    epics: kernelMixcOrderPayEpics,
    commands: kernelMixcOrderPayCommands,
    actors: kernelMixcOrderPayActors,
    errorMessages: kernelMixcOrderPayErrorMessages,
    parameters: kernelMixcOrderPayParameters,
    dependencies: [
        kernelMixcOrderBaseModule
    ],
    modulePreSetup: kernelMixcOrderPayModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelMixcOrderPaySlice} from "./features/slices";
export {kernelMixcOrderPayCommands} from "./features/commands";
export {kernelMixcOrderPayErrorMessages} from "./supports/errors";
export {kernelMixcOrderPayParameters} from "./supports/parameters";
export {kernelMixcOrderPayApis} from "./supports";