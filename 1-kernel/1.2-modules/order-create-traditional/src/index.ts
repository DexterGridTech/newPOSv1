import {moduleName} from "./moduleName";
import {kernelOrderCreateTraditionalSlice} from "./features/slices";
import {kernelOrderCreateTraditionalActors} from "./features/actors";
import {kernelOrderCreateTraditionalCommands} from "./features/commands";
import {kernelOrderCreateTraditionalModulePreSetup} from "./application/modulePreSetup";
import {kernelOrderCreateTraditionalErrorMessages} from "./supports/errors";
import {kernelOrderCreateTraditionalParameters} from "./supports/parameters";
import {kernelOrderCreateTraditionalEpics} from "./features/epics";
import {kernelOrderCreateTraditionalMiddlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {packageVersion} from './generated/packageVersion';

export const kernelOrderCreateTraditionalModule: AppModule = {
    name: moduleName,
    version: packageVersion,
    slices: kernelOrderCreateTraditionalSlice,
    middlewares: kernelOrderCreateTraditionalMiddlewares,
    epics: kernelOrderCreateTraditionalEpics,
    commands: kernelOrderCreateTraditionalCommands,
    actors: kernelOrderCreateTraditionalActors,
    errorMessages: kernelOrderCreateTraditionalErrorMessages,
    parameters: kernelOrderCreateTraditionalParameters,
    dependencies: [],
    modulePreSetup: kernelOrderCreateTraditionalModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./selectors";
export {kernelOrderCreateTraditionalSlice} from "./features/slices";
export {kernelOrderCreateTraditionalCommands} from "./features/commands";
export {kernelOrderCreateTraditionalErrorMessages} from "./supports/errors";
export {kernelOrderCreateTraditionalParameters} from "./supports/parameters";
export {kernelOrderCreateTraditionalApis} from "./supports";