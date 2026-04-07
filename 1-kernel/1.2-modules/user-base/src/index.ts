import {moduleName} from "./moduleName";
import {kernelUserBaseSlice} from "./features/slices";
import {kernelUserBaseActors} from "./features/actors";
import {kernelUserBaseCommands} from "./features/commands";
import {kernelUserBaseModulePreSetup} from "./application/modulePreSetup";
import {kernelUserBaseErrorMessages} from "./supports/errors";
import {kernelUserBaseParameters} from "./supports/parameters";
import {kernelUserBaseEpics} from "./features/epics";
import {kernelUserBaseMiddlewares} from "./features/middlewares";
import {AppModule, kernelCoreBaseModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {kernelCoreInterconnectionModule} from "@impos2/kernel-core-interconnection";
import {kernelCoreTaskModule} from "@impos2/kernel-core-task";
import {kernelCoreTerminalModule} from "@impos2/kernel-core-terminal";
import {packageVersion} from './generated/packageVersion';

export const kernelUserBaseModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelUserBaseSlice,
    middlewares: kernelUserBaseMiddlewares,
    epics: kernelUserBaseEpics,
    commands: kernelUserBaseCommands,
    actors: kernelUserBaseActors,
    errorMessages: kernelUserBaseErrorMessages,
    parameters: kernelUserBaseParameters,
    dependencies: [
        kernelCoreBaseModule,
        kernelCoreNavigationModule,
        kernelCoreInterconnectionModule,
        kernelCoreTaskModule,
        kernelCoreTerminalModule
    ],
    modulePreSetup: kernelUserBaseModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernelUserBaseSlice} from "./features/slices";
export {kernelUserBaseCommands} from "./features/commands";
export {kernelUserBaseErrorMessages} from "./supports/errors";
export {kernelUserBaseParameters} from "./supports/parameters";
export {kernelUserBaseApis} from "./supports";