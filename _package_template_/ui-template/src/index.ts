import {moduleName} from "./moduleName";
import {ui{{PACKAGE_NAME_PASCAL}}Slice} from "./features/slices";
import {ui{{PACKAGE_NAME_PASCAL}}Actors} from "./features/actors";
import {ui{{PACKAGE_NAME_PASCAL}}Commands} from "./features/commands";
import {ui{{PACKAGE_NAME_PASCAL}}ModulePreSetup} from "./application/modulePreSetup";
import {ui{{PACKAGE_NAME_PASCAL}}ErrorMessages} from "./supports/errors";
import {ui{{PACKAGE_NAME_PASCAL}}Parameters} from "./supports/parameters";
import {ui{{PACKAGE_NAME_PASCAL}}Epics} from "./features/epics";
import {ui{{PACKAGE_NAME_PASCAL}}Middlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";
import {kernelCoreNavigationModule} from "@impos2/kernel-core-navigation";
import {ui{{PACKAGE_NAME_PASCAL}}ScreenParts} from "./ui";

export const ui{{PACKAGE_NAME_PASCAL}}Module: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: ui{{PACKAGE_NAME_PASCAL}}Slice,
    middlewares: ui{{PACKAGE_NAME_PASCAL}}Middlewares,
    epics: ui{{PACKAGE_NAME_PASCAL}}Epics,
    commands: ui{{PACKAGE_NAME_PASCAL}}Commands,
    actors: ui{{PACKAGE_NAME_PASCAL}}Actors,
    errorMessages: ui{{PACKAGE_NAME_PASCAL}}ErrorMessages,
    parameters: ui{{PACKAGE_NAME_PASCAL}}Parameters,
    dependencies: [kernelCoreNavigationModule],
    modulePreSetup: ui{{PACKAGE_NAME_PASCAL}}ModulePreSetup,
    screenParts:ui{{PACKAGE_NAME_PASCAL}}ScreenParts
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export * from "./ui/moduleScreenParts";
export {ui{{PACKAGE_NAME_PASCAL}}Slice} from "./features/slices";
export {ui{{PACKAGE_NAME_PASCAL}}Commands} from "./features/commands";
export {ui{{PACKAGE_NAME_PASCAL}}ErrorMessages} from "./supports/errors";
export {ui{{PACKAGE_NAME_PASCAL}}Parameters} from "./supports/parameters";
export {ui{{PACKAGE_NAME_PASCAL}}Apis} from "./supports";