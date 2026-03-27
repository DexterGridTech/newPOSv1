import {moduleName} from "./moduleName";
import {adapterTauriSlice} from "./features/slices";
import {adapterTauriActors} from "./features/actors";
import {adapterTauriCommands} from "./features/commands";
import {adapterTauriModulePreSetup} from "./application/modulePreSetup";
import {adapterTauriErrorMessages} from "./supports/errors";
import {adapterTauriParameters} from "./supports/parameters";
import {adapterTauriEpics} from "./features/epics";
import {adapterTauriMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {uiCoreBaseModule} from "@impos2/ui-core-base";
import {adapterTaskDefinitions} from "./foundations/taskDefinitions";

export const adapterTauriModule: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: adapterTauriSlice,
    middlewares: adapterTauriMiddlewares,
    epics: adapterTauriEpics,
    commands: adapterTauriCommands,
    actors: adapterTauriActors,
    errorMessages: adapterTauriErrorMessages,
    parameters: adapterTauriParameters,
    dependencies: [uiCoreBaseModule],
    modulePreSetup: adapterTauriModulePreSetup,
    taskDefinitions:adapterTaskDefinitions
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export {adapterTauriSlice} from "./features/slices";
export {adapterTauriCommands} from "./features/commands";
export {adapterTauriErrorMessages} from "./supports/errors";
export {adapterTauriParameters} from "./supports/parameters";
export {adapterTauriApis} from "./supports";
