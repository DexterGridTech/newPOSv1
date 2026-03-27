import {moduleName} from "./moduleName";
import {kernel{{PACKAGE_NAME_PASCAL}}Slice} from "./features/slices";
import {kernel{{PACKAGE_NAME_PASCAL}}Actors} from "./features/actors";
import {kernel{{PACKAGE_NAME_PASCAL}}Commands} from "./features/commands";
import {kernel{{PACKAGE_NAME_PASCAL}}ModulePreSetup} from "./application/modulePreSetup";
import {kernel{{PACKAGE_NAME_PASCAL}}ErrorMessages} from "./supports/errors";
import {kernel{{PACKAGE_NAME_PASCAL}}Parameters} from "./supports/parameters";
import {kernel{{PACKAGE_NAME_PASCAL}}Epics} from "./features/epics";
import {kernel{{PACKAGE_NAME_PASCAL}}Middlewares} from "./features/middlewares";
import {AppModule} from "@impos2/kernel-core-base";

export const kernel{{PACKAGE_NAME_PASCAL}}Module: AppModule = {
    name: moduleName,
    version: '0.0.1',
    slices: kernel{{PACKAGE_NAME_PASCAL}}Slice,
    middlewares: kernel{{PACKAGE_NAME_PASCAL}}Middlewares,
    epics: kernel{{PACKAGE_NAME_PASCAL}}Epics,
    commands: kernel{{PACKAGE_NAME_PASCAL}}Commands,
    actors: kernel{{PACKAGE_NAME_PASCAL}}Actors,
    errorMessages: kernel{{PACKAGE_NAME_PASCAL}}ErrorMessages,
    parameters: kernel{{PACKAGE_NAME_PASCAL}}Parameters,
    dependencies: [],
    modulePreSetup: kernel{{PACKAGE_NAME_PASCAL}}ModulePreSetup
}


export * from "./types";
export * from "./foundations";
export * from "./supports";
export * from "./hooks";
export * from "./selectors";
export {kernel{{PACKAGE_NAME_PASCAL}}Slice} from "./features/slices";
export {kernel{{PACKAGE_NAME_PASCAL}}Commands} from "./features/commands";
export {kernel{{PACKAGE_NAME_PASCAL}}ErrorMessages} from "./supports/errors";
export {kernel{{PACKAGE_NAME_PASCAL}}Parameters} from "./supports/parameters";
export {kernel{{PACKAGE_NAME_PASCAL}}Apis} from "./supports";