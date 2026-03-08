import {moduleName} from "./moduleName";
import {kernelMixcUserSlice} from "./features/slices";
import {kernelMixcUserActors} from "./features/actors";
import {kernelMixcUserCommands} from "./features/commands";
import {kernelMixcUserModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcUserErrorMessages} from "./supports/errors";
import {kernelMixcUserParameters} from "./supports/parameters";
import {kernelMixcUserEpics} from "./features/epics";
import {kernelMixcUserMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {kernelCoreTaskModule} from "@impos2/kernel-core-task";
import {kernelCoreTerminalModule} from "@impos2/kernel-core-terminal";

export const kernelMixcUserModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernelMixcUserSlice,
    middlewares: kernelMixcUserMiddlewares,
    epics: kernelMixcUserEpics,
    commands: kernelMixcUserCommands,
    actors: kernelMixcUserActors,
    errorMessages: kernelMixcUserErrorMessages,
    parameters: kernelMixcUserParameters,
    dependencies: [
        kernelCoreBaseModule,
        kernelCoreNavigationModule,
        kernelCoreInterconnectionModule,
        kernelCoreTaskModule,
        kernelCoreTerminalModule
    ],
    modulePreSetup: kernelMixcUserModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {kernelMixcUserSlice} from "./features/slices";
export {kernelMixcUserCommands} from "./features/commands";
export {kernelMixcUserErrorMessages} from "./supports/errors";
export {kernelMixcUserParameters} from "./supports/parameters";
export {kernelMixcUserApis} from "./supports";