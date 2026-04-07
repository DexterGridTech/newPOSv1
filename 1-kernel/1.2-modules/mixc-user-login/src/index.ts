import {moduleName} from "./moduleName";
import {kernelMixcUserLoginSlice} from "./features/slices";
import {kernelMixcUserLoginActors} from "./features/actors";
import {kernelMixcUserLoginCommands} from "./features/commands";
import {kernelMixcUserLoginModulePreSetup} from "./application/modulePreSetup";
import {kernelMixcUserLoginErrorMessages} from "./supports/errors";
import {kernelMixcUserLoginParameters} from "./supports/parameters";
import {kernelMixcUserLoginEpics} from "./features/epics";
import {kernelMixcUserLoginMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {kernelCoreTaskModule} from "@impos2/kernel-core-task";
import {kernelCoreTerminalModule} from "@impos2/kernel-core-terminal";
import {packageVersion} from './generated/packageVersion';

export const kernelMixcUserLoginModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelMixcUserLoginSlice,
    middlewares: kernelMixcUserLoginMiddlewares,
    epics: kernelMixcUserLoginEpics,
    commands: kernelMixcUserLoginCommands,
    actors: kernelMixcUserLoginActors,
    errorMessages: kernelMixcUserLoginErrorMessages,
    parameters: kernelMixcUserLoginParameters,
    dependencies: [
        kernelCoreBaseModule,
        kernelCoreNavigationModule,
        kernelCoreInterconnectionModule,
        kernelCoreTaskModule,
        kernelCoreTerminalModule
    ],
    modulePreSetup: kernelMixcUserLoginModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelMixcUserLoginSlice} from "./features/slices";
export {kernelMixcUserLoginCommands} from "./features/commands";
export {kernelMixcUserLoginErrorMessages} from "./supports/errors";
export {kernelMixcUserLoginParameters} from "./supports/parameters";
export {kernelMixcUserLoginHttpServices} from "./supports";